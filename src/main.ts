import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

const SHUTDOWN_TIMEOUT_MS = 5000;

// Graceful shutdown can hang when Redis is unreachable (BullMQ waits to reconnect).
// Then the process never exits: watch mode stalls and the old copy keeps running.
const forceExitIfShutdownHangs = () => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      setTimeout(() => {
        console.error(
          `Shutdown took over ${SHUTDOWN_TIMEOUT_MS}ms after ${signal}, forcing exit`,
        );
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS).unref();
    });
  }
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();
  forceExitIfShutdownHangs();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
