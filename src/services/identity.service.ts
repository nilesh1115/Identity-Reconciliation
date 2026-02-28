import prisma from '../config/prisma';
import { IdentifyRequest, IdentifyResponse, ContactData } from '../types/contact.types';

export class IdentityService {
  async identify(data: IdentifyRequest): Promise<IdentifyResponse> {
    const { email, phoneNumber } = data;

    if (!email && !phoneNumber) {
      throw new Error('Email or phoneNumber is required');
    }

    const matches = await this.findMatches(email, phoneNumber);

    if (matches.length === 0) {
      return await this.createPrimaryContact(email, phoneNumber);
    }

    const primaryId = await this.reconcilePrimaries(matches);
    const allContacts = await this.getAllLinkedContacts(primaryId);
    
    if (this.shouldCreateSecondary(allContacts, email, phoneNumber)) {
      await this.createSecondaryContact(email, phoneNumber, primaryId);
      const updated = await this.getAllLinkedContacts(primaryId);
      return this.buildResponse(updated, primaryId);
    }

    return this.buildResponse(allContacts, primaryId);
  }

  private async findMatches(email?: string, phoneNumber?: string): Promise<ContactData[]> {
    const conditions = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });

    return await prisma.contact.findMany({
      where: { OR: conditions },
      orderBy: { createdAt: 'asc' }
    }) as ContactData[];
  }

  private async createPrimaryContact(email?: string, phoneNumber?: string): Promise<IdentifyResponse> {
    const contact = await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: 'primary'
      }
    });

    return {
      contact: {
        primaryContactId: contact.id,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: []
      }
    };
  }

  private async reconcilePrimaries(matches: ContactData[]): Promise<number> {
    const primaries = new Map<number, ContactData>();

    for (const match of matches) {
      if (match.linkPrecedence === 'primary') {
        primaries.set(match.id, match);
      } else if (match.linkedId) {
        const primary = await prisma.contact.findUnique({
          where: { id: match.linkedId }
        });
        if (primary) primaries.set(primary.id, primary as ContactData);
      }
    }

    const primaryList = Array.from(primaries.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const oldestPrimary = primaryList[0];
    const otherPrimaries = primaryList.slice(1);

    if (otherPrimaries.length > 0) {
      await this.mergePrimaries(otherPrimaries, oldestPrimary.id);
    }

    return oldestPrimary.id;
  }

  private async mergePrimaries(primaries: ContactData[], targetId: number): Promise<void> {
    for (const primary of primaries) {
      await prisma.contact.update({
        where: { id: primary.id },
        data: {
          linkPrecedence: 'secondary',
          linkedId: targetId,
          updatedAt: new Date()
        }
      });

      await prisma.contact.updateMany({
        where: { linkedId: primary.id },
        data: { linkedId: targetId, updatedAt: new Date() }
      });
    }
  }

  private async getAllLinkedContacts(primaryId: number): Promise<ContactData[]> {
    return await prisma.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    }) as ContactData[];
  }

  private shouldCreateSecondary(
    contacts: ContactData[],
    email?: string,
    phoneNumber?: string
  ): boolean {
    const existingEmails = contacts.map(c => c.email).filter(Boolean);
    const existingPhones = contacts.map(c => c.phoneNumber).filter(Boolean);

    const hasNewEmail = !!(email && !existingEmails.includes(email));
    const hasNewPhone = !!(phoneNumber && !existingPhones.includes(phoneNumber));

    return hasNewEmail || hasNewPhone;
  }

  private async createSecondaryContact(
    email: string | undefined,
    phoneNumber: string | undefined,
    linkedId: number
  ): Promise<void> {
    await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: 'secondary',
        linkedId
      }
    });
  }

  private buildResponse(contacts: ContactData[], primaryId: number): IdentifyResponse {
    const primary = contacts.find(c => c.id === primaryId);
    
    const emails = [...new Set(contacts.map(c => c.email).filter(Boolean) as string[])];
    const phones = [...new Set(contacts.map(c => c.phoneNumber).filter(Boolean) as string[])];
    const secondaryIds = contacts
      .filter(c => c.linkPrecedence === 'secondary')
      .map(c => c.id);

    if (primary?.email && emails.includes(primary.email)) {
      emails.splice(emails.indexOf(primary.email), 1);
      emails.unshift(primary.email);
    }

    if (primary?.phoneNumber && phones.includes(primary.phoneNumber)) {
      phones.splice(phones.indexOf(primary.phoneNumber), 1);
      phones.unshift(primary.phoneNumber);
    }

    return {
      contact: {
        primaryContactId: primaryId,
        emails,
        phoneNumbers: phones,
        secondaryContactIds: secondaryIds
      }
    };
  }
}
