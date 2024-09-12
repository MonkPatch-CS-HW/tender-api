import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PingModule } from './ping/ping.module';

@Module({
  imports: [PingModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static port: number = 3000;
  static hostname: string = '0.0.0.0';

  constructor(configService: ConfigService) {
    const addr = configService.get<string>('SERVER_ADDRESS', '');
    const [hostname, strPort] = addr.split(':');
    const port = parseInt(strPort);
    if (!hostname || !strPort || Number.isNaN(AppModule.port))
      throw new Error('Invalid SERVER_ADDRESS');

    AppModule.hostname ||= hostname;
    AppModule.port ||= port;
  }
}
