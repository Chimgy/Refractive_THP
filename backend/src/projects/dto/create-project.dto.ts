import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Origins the telemetry embed is allowed to post from (external_data.md
  // roadmap item 6). Optional at creation — an empty list fails closed on
  // /telemetry until someone actually configures it, rather than defaulting
  // to wide open.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_tld: false }, { each: true })
  allowedOrigins?: string[];
}
