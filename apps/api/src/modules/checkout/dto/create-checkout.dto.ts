import { IsInt, IsString, MaxLength, Min, MinLength, Max } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
