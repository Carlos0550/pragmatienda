export {};

declare global {
  type ServiceResponse = {
    status: number;
    message: string;
    data?: any;
    err?: string;
  };
}
