import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import * as cors from 'cors';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import { join } from 'path';
import * as express from 'express';
import { MyLogger } from './logger.service';
import { RawBodyMiddleware } from './middlewares/raw-body.middleware';
// main.ts or global setup
if (!global.crypto) {
  global.crypto = require('crypto');
}


async function bootstrap() {
  const app: any = await NestFactory.create(AppModule, {
   
    cors: true,
  });

    const logger = app.get(MyLogger);
  // Set it as the global logger
       app.useLogger(logger);
      //  app.use(new RawBodyMiddleware().use); // <-- Correct usage

        // app.use(express.json({
        //     type: 'application/json',
        //     verify: (req, res, buf) => {
        //       (req as any).rawBody = buf;
        //     },
        //   }));

        
    app.use(
    ['/shopify/shop/redact', '/shopify/customers/redact', '/shopify/customers/data_request'],
    new RawBodyMiddleware().use,
  );
    
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
  // app.useBodyParser('text'); // or bodyParser.text({ type: 'application/json' })

  // app.use('/shopify/webhooks', express.raw({ type: 'application/json' }));

  // const app = await NestFactory.create(AppModule);

  // app.use(cors({
  //   origin: 'http://localhost:3000',
  //   // origin: 'http://18.61.237.96',
  //   // origin: 'https://front.salegrowy.com',
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  //   // allowedHeaders: 'Content-Type, Authorization',
  //   allowedHeaders: [
  //     'Content-Type',
  //     'Authorization',
  //     'X-Shopify-Access-Token', // ✅ add this
  //   ],
  //   credentials: true,
  // }));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Salegrowy')
    .setDescription('Salegrowy Backend Testing For Mr. AK')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'bearer-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('salegrowyBackend', app, document);
  app.use(cookieParser()); 

  const port = process.env.PORT;
  await app.listen(`${port}`);
  dotenv.config();
}
bootstrap();

// Enable CORS for Next.js frontend
// app.enableCors({
//   origin: 'http://localhost:3000',
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
//   allowedHeaders: 'Content-Type, Authorization',
//   credentials: true,
// });
