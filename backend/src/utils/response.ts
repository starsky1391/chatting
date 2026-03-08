import { Response } from 'express';

interface ApiResponse<T = any> {
  code: number;
  data: T;
  msg: string;
}

class ResponseUtil {
  /**
   * Success response
   */
  static success<T = any>(res: Response, data: T, msg: string = 'success') {
    const response: ApiResponse<T> = {
      code: 200,
      data,
      msg
    };
    return res.status(200).json(response);
  }

  /**
   * Created response
   */
  static created<T = any>(res: Response, data: T, msg: string = 'created') {
    const response: ApiResponse<T> = {
      code: 201,
      data,
      msg
    };
    return res.status(201).json(response);
  }

  /**
   * Bad request response
   */
  static badRequest(res: Response, msg: string = 'bad request') {
    const response: ApiResponse<null> = {
      code: 400,
      data: null,
      msg
    };
    return res.status(400).json(response);
  }

  /**
   * Unauthorized response
   */
  static unauthorized(res: Response, msg: string = 'unauthorized') {
    const response: ApiResponse<null> = {
      code: 401,
      data: null,
      msg
    };
    return res.status(401).json(response);
  }

  /**
   * Forbidden response
   */
  static forbidden(res: Response, msg: string = 'forbidden') {
    const response: ApiResponse<null> = {
      code: 403,
      data: null,
      msg
    };
    return res.status(403).json(response);
  }

  /**
   * Not found response
   */
  static notFound(res: Response, msg: string = 'not found') {
    const response: ApiResponse<null> = {
      code: 404,
      data: null,
      msg
    };
    return res.status(404).json(response);
  }

  /**
   * Internal server error response
   */
  static internalError(res: Response, msg: string = 'internal server error') {
    const response: ApiResponse<null> = {
      code: 500,
      data: null,
      msg
    };
    return res.status(500).json(response);
  }
}

export default ResponseUtil;