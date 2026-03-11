import { Controller, Get } from '@nestjs/common';
import { AppService, HealthResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<string> {
    return await this.appService.getHello();
  }
  
  @Get('health')
  async healthCheck(): Promise<HealthResponse> {
    return this.appService.getHealth();
  }
}
