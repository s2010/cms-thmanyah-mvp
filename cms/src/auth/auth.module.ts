import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserAuthenticationService } from './domain/user-authentication.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET', 'dev-secret-key'),
        signOptions: { 
          expiresIn: '8h', // Standard work session duration
          issuer: 'thmanyah-cms',
        },
      }),
    }),
  ],
  providers: [AuthGuard, AuthService, UserAuthenticationService],
  controllers: [AuthController],
  exports: [AuthGuard, AuthService, UserAuthenticationService, JwtModule],
})
export class AuthModule {} 