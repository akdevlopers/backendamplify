import {
    Controller,
    Post,
    Patch,
    Delete,
    Get,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
    Query,
    Res,
    BadRequestException,
    NotFoundException,UseInterceptors,Logger
  } from '@nestjs/common';
  import { ContactService } from './contact.service';
  import { NewFieldDto, GroupDto, ContactDto } from './dto/contact.dto';
  import { ApiTags, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
  import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
  import { Response } from 'express';
  import * as fs from 'fs';
  import * as ExcelJS from 'exceljs';
  import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';

  
  // @UseGuards(JwtAuthGuard)
  @ApiTags('Contact')
  @Controller('contact')
  export class ContactController {
    constructor(private contactService: ContactService) {}

  // -------------------------------------------------------Contact API's--------------------------------------------------------------------------


      @Get('contact')
    @ApiOperation({ summary: 'Get Contact (Paginated)' })
    @ApiResponse({ status: 200, description: 'Contacts retrieved successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
     
    getContact(
      @Query('page') page: string,
      @Query('limit') limit: string,
      @Query('vendor_id') vendorId: string,
      @Query('search') search?: string,
    ) {
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const vendorIdNumber = parseInt(vendorId, 10);
    

      if (isNaN(vendorIdNumber)) {
        throw new BadRequestException('Invalid vendor_id');
      }
       

      return this.contactService.getContact(pageNumber, limitNumber, vendorIdNumber, search);
    }

        @Get('contacts-by-group')
        async getContactsByGroup(
          @Query('page') page: string,
          @Query('limit') limit: string,
          @Query('vendor_id') vendorId: string,
          @Query('group') groupId: string,
          @Query('search') search?: string,
        ) {
          // Convert string query params to numbers
          const pageNum = Number(page) || 1;
          const limitNum = Number(limit) || 25;
          const vendorIdNum = Number(vendorId);
          const groupIdNum = Number(groupId);

          return this.contactService.getContactsByGroupId(
            pageNum, limitNum, vendorIdNum, groupIdNum, search
          );
        }


      @Get('exportcontacts')
      async exportContacts123(@Query('vendorId') vendorId: number, @Res() res: Response) {
        console.log("wergvwervgwhr");
        const filePath = await this.contactService.exportContacts(vendorId);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);

        // Optional cleanup after stream end
        stream.on('end', () => {
          fs.unlink(filePath, () => {});
        });
      }


    @Post()
    @ApiOperation({ summary: 'Create a new contact' })
    @ApiResponse({ status: 201, description: 'The contact has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @UseInterceptors(DecryptInterceptor)
    async create(@Body() createContactDto: ContactDto) {
      const result = await this.contactService.createContact(createContactDto);

      if (!result.success) {
        return {
          success: false,
          message: result.message,
        };
      }

      return {
        success: true,
        message: result.message,
        data: result.data,
      };
    }


    @Patch(':id')
    @ApiOperation({ summary: 'Update a contact' })
    @ApiResponse({ status: 200, description: 'The contact has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'Contact not found.' })
    @UseInterceptors(DecryptInterceptor)
    async updateContact(@Param('id', ParseIntPipe) id: number, @Body() dto: ContactDto) {
      const result = await this.contactService.updateContact(id, dto);

      if (!result.success) {
        return {
          success: false,
          message: result.message,
        };
      }

      return {
        success: true,
        message: result.message,
        data: result.data,
      };
    }




  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 200, description: 'The contact has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Contact not found.' })
   
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.contactService.deleteContact(id);
  }



  @Delete('delete-multiple/:ids')
  @ApiOperation({ summary: 'Delete multiple contacts' })
  @ApiResponse({ status: 200, description: 'Contacts successfully deleted.' })
  @ApiResponse({ status: 400, description: 'Invalid ID list.' })
  
  async deleteMultiple(@Param('ids') ids: string) {
    const idArray = ids
      .split(',')
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id));
  
    if (idArray.length === 0) {
      throw new BadRequestException('No valid contact IDs provided.');
    }
  
    return this.contactService.deleteMultipleContacts(idArray);
  }

  @Post('add-contacts')
  @ApiOperation({ summary: 'Add multiple contacts to a group' })
   @UseInterceptors(DecryptInterceptor)
  async addContactsToGroup(
    @Body('groupId') groupId: number,
    @Body('contactIds') contactIds: number[]
  ) {
    return this.contactService.addContactsToGroup(groupId, contactIds);
  }
  

  
  @Get('countries')
  @ApiOperation({summary: 'Get countries'})
  @ApiResponse({ status: 201, description: 'The countries has been successfully Received.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  
  getCountry() {
    return this.contactService.getCountry();
  }

  // -------------------------------------------------------Custom Field API's--------------------------------------------------------------------------
  
    @Post('customfield')
    @ApiOperation({ summary: 'Create Custom Field' })
      @UseInterceptors(DecryptInterceptor)
    newField(@Body() dto: NewFieldDto) {
      return this.contactService.newField(dto);
    }
  
    @Patch('customfield/:id')
    @ApiOperation({ summary: 'Update Custom Field no need vendors__id' })
      @UseInterceptors(DecryptInterceptor)
    updateField(@Param('id', ParseIntPipe) id: number, @Body() dto: NewFieldDto) {
      return this.contactService.updateField(id, dto);
    }
  
    @Delete('customfield/:id')
    @ApiOperation({ summary: 'Delete Custom Field' })                                    
    deleteField(@Param('id', ParseIntPipe) id: number) {
      return this.contactService.deleteField(id);
    }
  
    // @Get('customfield')
    // @ApiOperation({ summary: 'Get All Custom Fields' })
    // getAllFields() {
    //   return this.contactService.getAllFields();
    // }

    @Get('fields')
    @ApiOperation({ summary: 'Get contact custom fields by vendor ID' })
    @ApiResponse({ status: 200, description: 'Custom fields retrieved successfully.' })
    getFields(@Query('vendors__id', ParseIntPipe) vendors__id: number) {
      return this.contactService.getFieldsByVendor(vendors__id);
    }

  // -------------------------------------------------------New Group API's--------------------------------------------------------------------------
  
    @Post('newgroup')
    @ApiOperation({ summary: 'Create Group' })
      @UseInterceptors(DecryptInterceptor)
    newGroup(@Body() dto: GroupDto) {
      return this.contactService.newGroup(dto);
    }
  
    @Patch('group/:id')
    @ApiOperation({ summary: 'Update Group' })
      @UseInterceptors(DecryptInterceptor)
    updateGroup(@Param('id', ParseIntPipe) id: number, @Body() dto: GroupDto) {
      return this.contactService.updateGroup(id, dto);
    }
  
    @Delete('group/:id')
    @ApiOperation({ summary: 'Delete Group' })
    deleteGroup(@Param('id', ParseIntPipe) id: number) {
      return this.contactService.deleteGroup(id);
    }
  
    // @Get('group')
    // @ApiOperation({ summary: 'Get All Groups' })
    // getAllGroups() {
    //   return this.contactService.getAllGroups();
    // }

    @Get('group')
    @ApiOperation({ summary: 'Get groups by vendor ID' })
    @ApiResponse({ status: 200, description: 'Custom fields retrieved successfully.' })
    getAllGroups(@Query('vendors__id', ParseIntPipe) vendors__id: number) {
      return this.contactService.getAllGroups(vendors__id);
    }


    @Post('group/toggle-status')
    @ApiOperation({ summary: 'Toggle group status by vendor UID and group ID' })
    @ApiResponse({ status: 200, description: 'Group status toggled successfully.' })
     @UseInterceptors(DecryptInterceptor)
    async toggleGroupStatus(@Body() body?: { vendorUid?: string; groupId?: number }) {
      if (!body || !body.vendorUid || !body.groupId) {
        throw new BadRequestException('vendorUid and groupId are required in the request body');
      }

      return this.contactService.toggleGroupStatus(body.vendorUid, body.groupId);
    }







    @Get('single/:contact_uid')
      @ApiOperation({ summary: 'Get a single Contact by contact_uid' })
      @ApiResponse({ status: 200, description: 'Contact retrieved successfully' })
      @ApiResponse({ status: 404, description: 'Contact not found' })
      async getContactById(@Param('contact_uid') contactUid: string) {
        if (!contactUid) {
          throw new BadRequestException('contact_uid is required');
        }

        const contact = await this.contactService.getContactByUid(contactUid);

        if (!contact) {
          throw new NotFoundException('Invalid contact_uid');
        }

        return contact;
      } 
  }