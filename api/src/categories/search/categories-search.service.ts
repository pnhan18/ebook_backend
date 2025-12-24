import { Injectable, OnModuleInit } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesSearchService implements OnModuleInit {
  private readonly index = 'categories';

  constructor(private readonly searchService: SearchService) {}

  async onModuleInit() {
    await this.createIndex();
  }

  async createIndex() {
    await this.searchService.createIndex(this.index, {
      settings: {
        analysis: {
          analyzer: {
            vietnamese: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'integer' },
          name: {
            type: 'text',
            analyzer: 'vietnamese',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          slug: { type: 'keyword' },
          description: { type: 'text' },
          parentId: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'date' },
        },
      },
    });
  }

  async indexCategory(category: Category) {
    return this.searchService.indexDocument(this.index, category.id.toString(), {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      isActive: category.isActive,
      createdAt: category.createdAt,
    });
  }

  async updateCategory(category: Category) {
    return this.searchService.updateDocument(this.index, category.id.toString(), {
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      isActive: category.isActive,
    });
  }

  async deleteCategory(id: number) {
    return this.searchService.deleteDocument(this.index, id.toString());
  }

  async search(query: string, options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const from = (page - 1) * limit;

    const result = await this.searchService.search(this.index, {
      _source: ['id', 'name', 'slug', 'description'],
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['name^2'],
                fuzziness: 'AUTO',
                prefix_length: 1,
              },
            },
          ],
          filter: [{ term: { isActive: true } }],
        },
      },
      from,
      size: limit,
    });

    return {
      data: result.hits.hits.map((hit: any) => hit._source),
      total: (result.hits.total as any).value,
      page,
      limit,
    };
  }

  async bulkIndexCategories(categories: Category[]) {
    const documents = categories.map((category) => ({
      id: category.id.toString(),
      document: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        isActive: category.isActive,
        createdAt: category.createdAt,
      },
    }));

    return this.searchService.bulkIndex(this.index, documents);
  }
}
