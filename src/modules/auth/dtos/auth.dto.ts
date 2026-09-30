export interface SafeUserDto {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponseDto {
  token: string;
  user: SafeUserDto;
}

export interface AuthenticatedUserDto {
  id: string;
  name: string;
}
