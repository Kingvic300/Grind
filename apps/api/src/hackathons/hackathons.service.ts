import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHackathonDto, UpdateHackathonDto } from './hackathon.dto';

const DATE_FIELDS = ['startDate', 'endDate', 'registrationDeadline', 'submissionDeadline'] as const;

/** Converts ISO date strings from a DTO into Date objects, keeping null as "clear this field". */
function toData(dto: UpdateHackathonDto) {
  const data: Record<string, unknown> = { ...dto };
  for (const field of DATE_FIELDS) {
    const value = dto[field];
    if (value !== undefined) data[field] = value ? new Date(value) : null;
  }
  return data;
}

@Injectable()
export class HackathonsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.hackathon.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateHackathonDto) {
    const data = toData(dto);
    this.checkDates(data);
    // New entries go to the end of their board column.
    if (dto.position === undefined) {
      const last = await this.prisma.hackathon.aggregate({ where: { userId }, _max: { position: true } });
      data.position = (last._max.position ?? 0) + 1;
    }
    return this.prisma.hackathon.create({
      data: { ...(data as Prisma.HackathonUncheckedCreateInput), userId },
    });
  }

  async update(userId: string, id: string, dto: UpdateHackathonDto) {
    const current = await this.prisma.hackathon.findFirst({ where: { id, userId } });
    if (!current) throw new NotFoundException('That hackathon does not exist.');
    const data = toData(dto);
    this.checkDates({ ...current, ...data });
    return this.prisma.hackathon.update({ where: { id }, data: data as Prisma.HackathonUncheckedUpdateInput });
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.hackathon.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('That hackathon does not exist.');
  }

  private checkDates(data: Record<string, unknown>) {
    const start = data.startDate as Date | null | undefined;
    const end = data.endDate as Date | null | undefined;
    if (start && end && end < start) throw new BadRequestException('The end date is before the start date.');
  }
}
