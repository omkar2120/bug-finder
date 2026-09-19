import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject, ZodTypeAny } from "zod";

export function validate(schema: {
  body?: AnyZodObject | ZodTypeAny;
  query?: AnyZodObject | ZodTypeAny;
  params?: AnyZodObject | ZodTypeAny;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query) as typeof req.query;
      if (schema.params) req.params = schema.params.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
}
