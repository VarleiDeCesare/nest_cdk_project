import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as AwsXRay from 'aws-xray-sdk';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(AwsXRay.express.openSegment(process.env.AWS_XRAY_TRACING_NAME));
  AwsXRay.config([AwsXRay.plugins.ECSPlugin]);
  AwsXRay.captureHTTPsGlobal(require('http'));
  app.use(AwsXRay.express.closeSegment());
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
