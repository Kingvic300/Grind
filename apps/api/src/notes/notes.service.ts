import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { CreateNoteDto, UpdateNoteDto } from './note.dto';

const INCLUDE = { user: { select: { id: true, name: true } } } satisfies Prisma.NoteInclude;

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly events: EventsService,
  ) {}

  async list(userId: string, spaceId: string | null) {
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    return this.prisma.note.findMany({
      where: { OR: [{ userId, spaceId: null }, ...(spaceId ? [{ spaceId }] : [])] },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE,
    });
  }

  async create(userId: string, dto: CreateNoteDto) {
    const spaceId = dto.spaceId || null;
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const data = this.toData(dto);
    this.check({ body: null, url: null, ...data });
    const note = await this.prisma.note.create({
      data: { ...(data as Prisma.NoteUncheckedCreateInput), userId, spaceId },
      include: INCLUDE,
    });
    await this.announce(userId, spaceId);
    return note;
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    const current = await this.findEditable(userId, id);
    const data = this.toData(dto);
    this.check({ ...current, ...data });
    // A new reminder time means a new email, even if the old one was sent.
    if (dto.remindAt !== undefined && (data.remindAt as Date | null)?.getTime() !== current.remindAt?.getTime()) {
      data.remindedAt = null;
    }
    const note = await this.prisma.note.update({ where: { id }, data: data as Prisma.NoteUncheckedUpdateInput, include: INCLUDE });
    await this.announce(userId, current.spaceId);
    return note;
  }

  async remove(userId: string, id: string) {
    const current = await this.findEditable(userId, id);
    await this.prisma.note.delete({ where: { id } });
    await this.announce(userId, current.spaceId);
  }

  /** Personal notes are editable by their owner. Team notes by every member of the team. */
  private async findEditable(userId: string, id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] },
    });
    if (!note) throw new NotFoundException('That note does not exist.');
    return note;
  }

  private toData(dto: UpdateNoteDto) {
    const data: Record<string, unknown> = { ...dto };
    delete data.spaceId;
    if (dto.remindAt !== undefined) data.remindAt = dto.remindAt ? new Date(dto.remindAt) : null;
    if (typeof dto.body === 'string' && !dto.body) data.body = null;
    if (typeof dto.url === 'string' && !dto.url) data.url = null;
    return data;
  }

  private check(note: Record<string, unknown>) {
    if (!note.body && !note.url) throw new BadRequestException('Write something or paste a link.');
  }

  private async announce(userId: string, spaceId: string | null) {
    const userIds = spaceId ? await this.spaces.memberIds(spaceId) : [userId];
    this.events.notify(userIds, { type: 'notes' });
  }
}
