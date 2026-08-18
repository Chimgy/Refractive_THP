import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGithubRepoLinkDto {
  @IsString()
  @IsNotEmpty()
  owner: string;

  @IsString()
  @IsNotEmpty()
  repo: string;

  @IsString()
  @IsNotEmpty()
  installationId: string;
}
