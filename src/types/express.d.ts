declare namespace Express {
  interface Request {
    user?: {
      readonly userId: string;
      readonly email: string;
    };
  }
}
