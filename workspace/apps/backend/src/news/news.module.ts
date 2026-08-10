// NewsModule — news providers, sentiment service client, sentiment strategy plugin
// Owner: Thuan
// See: kb/modules/news-sentiment.md, kb/contracts/news.yaml

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [],
  controllers: [],
  exports: [],
})
export class NewsModule {}
