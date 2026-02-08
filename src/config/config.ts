export default () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: process.env.REDIS_TTL ? parseInt(process.env.REDIS_TTL, 10) : 3600,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '30d',
  },

  security: {
    bcryptRounds: process.env.BCRYPT_ROUNDS
      ? parseInt(process.env.BCRYPT_ROUNDS, 10)
      : 12,
    resetPasswordExpiration: process.env.RESET_PASSWORD_EXPIRATION
      ? parseInt(process.env.RESET_PASSWORD_EXPIRATION, 10)
      : 600000,
  },

  mail: {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 587,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM || 'noreply@yourapp.com',
  },

  rateLimit: {
    login: {
      max: process.env.LOGIN_RATE_LIMIT
        ? parseInt(process.env.LOGIN_RATE_LIMIT, 10)
        : 5,
      windowMs: process.env.LOGIN_RATE_WINDOW
        ? parseInt(process.env.LOGIN_RATE_WINDOW, 10)
        : 900000,
    },
    reset: {
      max: process.env.RESET_RATE_LIMIT
        ? parseInt(process.env.RESET_RATE_LIMIT, 10)
        : 3,
      windowMs: process.env.RESET_RATE_WINDOW
        ? parseInt(process.env.RESET_RATE_WINDOW, 10)
        : 3600000,
    },
  },
});
