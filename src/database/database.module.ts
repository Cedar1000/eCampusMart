import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow('DB_HOST'),
        port: configService.getOrThrow('DB_PORT'),
        username: configService.getOrThrow('DB_USER'),
        password: configService.getOrThrow('DB_PASSWORD'),
        database: configService.getOrThrow('DB_NAME'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: true,
        autoLoadEntities: true,
        // ssl: { rejectUnauthorized: false },

        // Each serverless instance opens its own pool, so keep it small there
        extra: { max: Number(configService.get('DB_POOL_MAX') ?? 10) },

        subscribers: [],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
