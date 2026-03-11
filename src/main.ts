import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { isDev } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: isDev
      ? ['log', 'warn', 'error', 'debug', 'verbose']
      : ['log', 'warn', 'error'],
  });
  
  const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL'];
  const missingEnvVars = requiredEnvVars.filter((env) => !process.env[env]);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    );
  }
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
