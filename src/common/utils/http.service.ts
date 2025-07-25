import { Injectable } from '@nestjs/common';
import { HttpService as AxiosHttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class HttpService {
  constructor(private readonly httpService: AxiosHttpService) {}

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await lastValueFrom(this.httpService.get<T>(url, { params }));
    return response.data;
  }

  async post<T>(url: string, data: any): Promise<T> {
    const response = await lastValueFrom(this.httpService.post<T>(url, data));
    return response.data;
  }

  async delete<T>(url: string, params?: any): Promise<T> {
    const response = await lastValueFrom(this.httpService.delete<T>(url, { params }));
    return response.data;
  }
}
