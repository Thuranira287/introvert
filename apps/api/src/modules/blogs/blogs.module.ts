import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { CreatorModule } from '../creator/creator.module';

@Module({
  imports: [PrismaModule, CreatorModule],
  providers: [BlogsService],
  controllers: [BlogsController],
  exports: [BlogsService],
})
export class BlogsModule {}
