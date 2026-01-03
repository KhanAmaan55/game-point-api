import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { isDev } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: isDev
      ? ['log', 'warn', 'error', 'debug', 'verbose']
      : ['log', 'warn', 'error'],
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
