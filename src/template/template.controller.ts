import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
  BadRequestException, 
  UploadedFiles,
  UseInterceptors, Req 
  
} from '@nestjs/common';
import { TemplateService } from './template.service';
import { multerOptions } from '../config/multer.config';
import {
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';

// @UseGuards(JwtAuthGuard)
@ApiTags('Template')
@Controller('template')
export class TemplateController {
  constructor(private TemplateService: TemplateService) {}

  // @Get('/template')
  // @ApiOperation({ summary: 'Get All Template (Paginated & by vendorId)' })
  // getAllTemplate(
  //   @Query('page') page: string,
  //   @Query('limit') limit: string,
  //   @Query('vendorId') vendorId: string,
  // ) {
  //   const pageNumber = parseInt(page) || 1;
  //   const limitNumber = parseInt(limit) || 10;
  //   const vendorIdNumber = parseInt(vendorId);
  //   console.log(vendorIdNumber);
  
  //   if (isNaN(vendorIdNumber)) {
  //     throw new BadRequestException('Invalid vendorId');
  //   }
  
  //   return this.TemplateService.getAllTemplate(pageNumber, limitNumber, vendorIdNumber);
  // }
    @Get('/template')
      @ApiOperation({ summary: 'Get All Template (Paginated & by vendorId)' })
      getAllTemplate(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('vendorId') vendorId: string,
        @Query('search') search: string,
      ) {
        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 10;
        const vendorIdNumber = parseInt(vendorId);

        if (isNaN(vendorIdNumber)) {
          throw new BadRequestException('Invalid vendorId');
        }

        return this.TemplateService.getAllTemplate(
          pageNumber,
          limitNumber,
          vendorIdNumber,
          search?.trim() || null
        );
      }

      @Get('columns')
      async getColumns() {
        const columns = await this.TemplateService.getTableColumns();
        return { columns };
      }


      @Get('contactcolumns')
      async getcontactColumns() {
        const columns = await this.TemplateService.getcontactColumns();
        return { columns };
      }

 
          @Post('/uploadTemplateFiles')
          @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
          @ApiOperation({ summary: 'uploadTemplateFiles' })

          uploadTemplateFiles(@UploadedFiles() files: Express.Multer.File[],@Query('vendorUid') vendorUid: string,@Req() req: Request,@Body() body: any) {
            return this.TemplateService.uploadTemplateFiles(files,vendorUid,req,body);
          }   


        @Post('/createTemplate')
        @ApiOperation({ summary: 'createTemplate' })
        @UseInterceptors(DecryptInterceptor)

        createTemplate(
          @Body('name') name: string, @Body('category') category: string, @Body('language') language: string,@Body('components') components: string,@Body('vendorUid') vendorUid: string,@Body() body: any
          ) {
            return this.TemplateService.createTemplate(name,category,language,components,vendorUid,body);
          }   


        @Post('/syncTemplate')
        @ApiOperation({ summary: 'Sync Template' })
          @UseInterceptors(DecryptInterceptor)
        syncTemplate(@Body('vendorUid') vendorUid: string) {
          return this.TemplateService.syncTemplate(vendorUid);
        }

        @Post('/updateTemplate')
        @ApiOperation({ summary: 'updateTemplate' })
        @UseInterceptors(DecryptInterceptor)
        updateTemplate(
          @Body('name') name: string, @Body('category') category: string, @Body('language') language: string,@Body('components') components: string,@Body('vendorUid') vendorUid: string,@Body('templateId') templateId: string,@Body() body: any,@Body('parameter_format') parameter_format: string
          ) {
            return this.TemplateService.updateTemplate(name,category,language,components,vendorUid,templateId,body,parameter_format);
          }

        @Post('/syncSingleTemplate')
        
        @ApiOperation({ summary: 'syncSingleTemplate' })
        @UseInterceptors(DecryptInterceptor)
        syncSingleTemplate(
        @Body('vendorUid') vendorUid: string,@Body('templateId') templateId: string,@Body('primaryId') primaryId: string
        ) {
          return this.TemplateService.syncSingleTemplate(vendorUid,templateId,primaryId);
        }
        @Post('/deleteTemplate')
        @ApiOperation({ summary: 'deleteTemplate' })

        deleteTemplate(
        @Body('vendorUid') vendorUid: string,@Body('templateId') templateId: string
        ) {
          return this.TemplateService.deleteTemplate(vendorUid,templateId);
        }

}
