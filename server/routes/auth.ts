import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TurnstileService } from '../services/TurnstileService.js';
import { env } from '../config/env.js';

interface TurnstileVerifyRequest {
  Body: {
    token: string;
    action?: string;
  };
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Initialize Turnstile service
  const turnstileService = new TurnstileService(env.TURNSTILE_SECRET_KEY);

  // Verify Turnstile token
  fastify.post<TurnstileVerifyRequest>('/verify-turnstile', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
          action: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<TurnstileVerifyRequest>, reply: FastifyReply) => {
    try {
      const { token, action } = request.body;
      
      if (!token) {
        return reply.status(400).send({
          success: false,
          error: 'Token is required'
        });
      }

      // Get client IP
      const ip = request.ip || 
                 request.headers['x-forwarded-for']?.toString() || 
                 request.headers['cf-connecting-ip']?.toString() ||
                 request.socket.remoteAddress;

      // Verify the token
      const result = await turnstileService.verifyTokenWithValidation(
        token, 
        ip, 
        action
      );

      if (result.valid) {
        return reply.send({
          success: true,
          message: 'Token verified successfully'
        });
      } else {
        return reply.status(400).send({
          success: false,
          error: result.error || 'Token verification failed'
        });
      }
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Health check for Turnstile service
  fastify.get('/turnstile-health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        message: 'Turnstile service is healthy',
        configured: !!env.TURNSTILE_SECRET_KEY
      });
    } catch (error) {
      console.error('Turnstile health check error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Service unhealthy'
      });
    }
  });
}
