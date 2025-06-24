import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? 
      ['https://thmanyah.com', 'https://admin.thmanyah.com'] : 
      true,
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  const port = process.env.PORT || 3000;
  
  // Listen on all interfaces for Docker compatibility
  await app.listen(port, '0.0.0.0');
  
  console.log(`Thmanyah CMS running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
}); 