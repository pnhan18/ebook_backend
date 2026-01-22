import { Injectable } from '@nestjs/common';
import { BookPurchase, Prisma, Book } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IBookPurchaseRepository } from '../interfaces';

@Injectable()
export class BookPurchaseRepository implements IBookPurchaseRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: Prisma.BookPurchaseCreateInput): Promise<BookPurchase> {
    return this.prisma.bookPurchase.create({ data });
  }

  async findByUserAndBook(
    userId: number,
    bookId: number,
  ): Promise<BookPurchase | null> {
    return this.prisma.bookPurchase.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
  }

  async findByUserId(userId: number): Promise<(BookPurchase & { book: Book })[]> {
    return this.prisma.bookPurchase.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { purchasedAt: 'desc' },
    });
  }
}
