import { Controller, Post, Body, Get, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { LoginCredentials } from './domain/user-authentication.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(200)
  @Post('login')
  async login(@Body() credentials: LoginCredentials, @Request() req: any) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await this.authService.login(credentials, clientInfo);
    
    return {
      access_token: result.token,
      user: result.user,
      expires_in: '8h',
    };
  }

  @Get('dev-token')
  async getDevToken() {
    const nodeEnv = process?.env?.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      return { error: 'Development endpoint not available in production' };
    }
    
    const token = await this.authService.createDevToken();
    return { 
      access_token: token,
      expires_in: '8h',
    };
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await this.authService.revokeSession(sessionId);
    }
    
    return { 
      message: 'Logged out',
    };
  }

  @UseGuards(AuthGuard)
  @Get('verify')
  async verify(@Request() req: any) {
    return { 
      status: 'authenticated',
      user: {
        username: req.user.username,
        roles: req.user.roles,
      },
      session_id: req.user.sessionId,
      verified_at: new Date().toISOString(),
    };
  }

  @UseGuards(AuthGuard)
  @Get('session-stats')
  async getSessionStats() {
    const stats = this.authService.getSessionStats();
    return {
      ...stats,
      retrieved_at: new Date().toISOString(),
    };
  }
} 