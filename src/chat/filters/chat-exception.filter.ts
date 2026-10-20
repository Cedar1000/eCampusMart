import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

/**
 * Sends HttpExceptions (validation failures, 403s, 404s) to the socket as
 * { status: 'error', message } with their real message. Anything else, such as a
 * database error, keeps the base filter's generic "Internal server error", so its
 * details stay in the server log.
 */
@Catch()
export class ChatExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && 'message' in response
          ? response.message
          : exception.message;

      return super.catch(
        new WsException(
          Array.isArray(message) ? message.join('; ') : String(message),
        ),
        host,
      );
    }

    if (!(exception instanceof WsException)) {
      console.error('Chat socket event failed:', exception);
    }

    return super.catch(exception, host);
  }
}
