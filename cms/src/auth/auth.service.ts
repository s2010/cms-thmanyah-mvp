import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserAuthenticationService, LoginCredentials } from './domain/user-authentication.service';

interface TokenPayload {
  sub: string;
  username: string;
  roles: string[];
  sessionId: string;
}

interface AuthResult {
  token: string;
  user: {
    username: string;
    roles: string[];
    sessionId: string;
  };
}

interface SessionStats {
  activeSessions: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userAuth: UserAuthenticationService,
  ) {}

  async login(credentials: LoginCredentials, clientInfo?: { ip?: string; userAgent?: string }): Promise<AuthResult> {
    const session = await this.userAuth.authenticateUser(credentials, clientInfo);
    const token = await this.generateToken(session);
    
    return {
      token,
      user: {
        username: session.username,
        roles: session.roles,
        sessionId: session.sessionId,
      },
    };
  }

  async generateToken(session: any): Promise<string> {
    const payload: TokenPayload = { 
      sub: session.userId || session.sub, 
      username: session.username,
      roles: session.roles,
      sessionId: session.sessionId,
    };
    
    return this.jwtService.signAsync(payload);
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync(token);
      
      if (decoded.sessionId) {
        const sessionExists = this.userAuth.validateSession(decoded.sessionId);
        if (!sessionExists) {
          throw new UnauthorizedException('Session expired');
        }
      }
      
      return decoded;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    this.userAuth.revokeSession(sessionId);
    this.logger.log(`Session revoked: ${sessionId}`);
  }

  async createDevToken(): Promise<string> {
    const devSession = {
      userId: 'dev-admin',
      username: 'developer',
      roles: ['admin', 'developer'],
      sessionId: `dev_${Date.now()}`,
    };
    
    this.logger.warn('Development token created - not for production use');
    return this.generateToken(devSession);
  }

  getSessionStats(): SessionStats {
    return {
      activeSessions: this.userAuth.getActiveSessionsCount(),
    };
  }
} 