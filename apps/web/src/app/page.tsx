"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCheckoutAttempt,
  getOrderWithKey,
  listProducts,
  type OrderStatus,
  type Product,
} from "@/lib/api";
import {
  clearAttempt,
  getAttemptForPayload,
  getLatestAttempt,
  persistAttempt,
} from "@/lib/idempotency";
import { toHumanMessage } from "@/lib/ui-errors";

type UiState =
  | { kind: "idle" }
  | { kind: "loadingProducts" }
  | { kind: "submitting" }
  | { kind: "polling"; orderId: string }
  | { kind: "success"; orderId: string }
  | { kind: "error"; error: unknown; canRetry: boolean; orderId?: string };

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [ui, setUi] = useState<UiState>({ kind: "loadingProducts" });
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  const pollAbortRef = useRef<AbortController | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  useEffect(() => {
    let cancelled = false;
    setUi({ kind: "loadingProducts" });

    listProducts()
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        if (data.length > 0) setSelectedProductId((prev) => prev || data[0]!.id);
        setUi({ kind: "idle" });
      })
      .catch((e) => {
        if (cancelled) return;
        setUi({ kind: "error", error: e, canRetry: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckout() {
    if (!selectedProductId) return;

    setOrderStatus(null);
    setUi({ kind: "submitting" });

    // Critical: only reuse an idempotencyKey for the same payload (productId + quantity).
    const previous = getAttemptForPayload({
      productId: selectedProductId,
      quantity,
    });

    try {
      const attempt = await createCheckoutAttempt({
        idempotencyKey: previous?.idempotencyKey,
        productId: selectedProductId,
        quantity,
      });

      persistAttempt({
        idempotencyKey: attempt.idempotencyKey,
        productId: selectedProductId,
        quantity,
      });

      setUi({ kind: "polling", orderId: attempt.orderId });
      await pollOrderUntilFinal(attempt.orderId);
    } catch (e) {
      setUi({ kind: "error", error: e, canRetry: true });
    }
  }

  async function pollOrderUntilFinal(orderId: string) {
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    const start = Date.now();
    const timeoutMs = 20_000;
    const attempt = getLatestAttempt();
    if (!attempt?.idempotencyKey) {
      setUi({
        kind: "error",
        error: { code: "TECHNICAL_FAILURE" },
        canRetry: true,
        orderId,
      });
      return;
    }

    while (!controller.signal.aborted) {
      const status = await getOrderWithKey({
        orderId,
        idempotencyKey: attempt.idempotencyKey,
      });
      setOrderStatus(status.status);

      if (status.status === "CONFIRMED") {
        clearAttempt();
        setUi({ kind: "success", orderId });
        return;
      }

      if (status.status === "FAILED") {
        setUi({
          kind: "error",
          error: { code: status.failureCode },
          canRetry: true,
          orderId,
        });
        return;
      }

      if (Date.now() - start > timeoutMs) {
        setUi({
          kind: "error",
          error: { code: "ERP_TEMPORARY" },
          canRetry: true,
          orderId,
        });
        return;
      }

      await new Promise((r) => setTimeout(r, 900));
    }
  }

  const disableSubmit =
    ui.kind === "loadingProducts" ||
    ui.kind === "submitting" ||
    ui.kind === "polling";

  const message =
    ui.kind === "error"
      ? toHumanMessage(ui.error)
      : ui.kind === "success"
        ? { title: "Compra confirmada", description: `Pedido: ${ui.orderId}` }
        : null;

  return (
    <div className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <h1 className="text-lg font-semibold">CaseCellShop</h1>
          <p className="text-sm text-zinc-600">
            Mini checkout com proteção de estoque e idempotência.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <section className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Produtos</h2>
            {ui.kind === "loadingProducts" ? (
              <span className="text-sm text-zinc-600">Carregando…</span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {products.map((p) => {
              const selected = p.id === selectedProductId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProductId(p.id)}
                  className={[
                    "rounded-md border px-3 py-3 text-left transition",
                    selected
                      ? "border-zinc-900 bg-zinc-50"
                      : "hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-zinc-600">{p.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {(p.priceCents / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </div>
                      <div className="text-sm text-zinc-600">
                        Estoque: {p.available}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-lg border bg-white p-4">
          <h2 className="text-base font-semibold">Checkout</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Produto selecionado</label>
              <div className="mt-1 rounded-md border bg-zinc-50 px-3 py-2 text-sm">
                {selectedProduct ? selectedProduct.name : "—"}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="qty">
                Quantidade
              </label>
              <input
                id="qty"
                type="number"
                min={1}
                value={Number.isFinite(quantity) ? quantity : 1}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={disableSubmit || !selectedProductId}
              onClick={handleCheckout}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {ui.kind === "submitting" || ui.kind === "polling"
                ? "Processando…"
                : "Finalizar compra"}
            </button>

            <div className="text-sm text-zinc-600">
              {ui.kind === "polling" ? (
                <span>
                  Status do pedido:{" "}
                  <span className="font-medium">
                    {orderStatus ?? "PENDING"}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {message ? (
            <div
              className={[
                "mt-4 rounded-md border px-3 py-3 text-sm",
                ui.kind === "success"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50",
              ].join(" ")}
            >
              <div className="font-medium">{message.title}</div>
              {message.description ? (
                <div className="mt-1 text-zinc-700">{message.description}</div>
              ) : null}
              {"requestId" in message && (message as any).requestId ? (
                <div className="mt-2 text-xs text-zinc-600">
                  requestId: {(message as any).requestId}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
