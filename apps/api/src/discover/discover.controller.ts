import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { DiscoverService } from './discover.service';

class ScanLinkDto {
  @IsString()
  @Length(4, 500, { message: 'Paste the full link of the hackathon page.' })
  url: string;
}

// Behind login, so the API is not an open proxy for these sites.
@UseGuards(AuthGuard)
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  /**
   * The listing JSON is large, so it goes out gzipped (compressed once per refresh) with an ETag:
   * a browser that already has this version gets an empty 304.
   */
  @Get()
  async list(@Req() req: Request, @Res() res: Response) {
    const { json, gzip, etag } = await this.discover.payload();
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.type('application/json');
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      return res.send(gzip);
    }
    return res.send(json);
  }

  /** Reads a hackathon from a pasted link. Returns a draft for the form; nothing is saved. */
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @HttpCode(200)
  @Post('scan')
  scan(@Body() dto: ScanLinkDto) {
    return this.discover.scan(dto.url);
  }
}
