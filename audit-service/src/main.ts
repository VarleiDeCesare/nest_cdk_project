import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as AWSXray from 'aws-xray-sdk'
import { JsonLoggerService, LoggerFactory } from 'json-logger-service';
import { hostname } from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(AWSXray.express.openSegment(process.env.AWS_XRAY_TRACING_NAME))
  AWSXray.config([AWSXray.plugins.ECSPlugin])
  AWSXray.captureHTTPsGlobal(require('http'))
  app.use(AWSXray.express.closeSegment())

  LoggerFactory.setDefaultLogCustomContextBuilder({
    buildCustomContext(): any {
      return {
        pid: undefined,
        hostname: undefined
      }
    }
  })
  app.useLogger(new JsonLoggerService('AuditService'))
  
  await app.listen(8090);
}
bootstrap();
