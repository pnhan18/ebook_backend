import { PrismaClient, SignupMethod } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Client } from '@elastic/elasticsearch';

const prisma = new PrismaClient();
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

async function main() {
  console.log('🌱 Starting seed...');

  // Seed Roles
  const roles = [
    { name: 'admin', description: 'Quản trị viên hệ thống - có toàn quyền quản lý' },
    { name: 'user', description: 'Người dùng thông thường - đọc sách và tương tác cơ bản' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('✅ Roles seeded');

  // Seed Categories
  const categories = [
    { name: 'Văn học', slug: 'van-hoc', description: 'Các tác phẩm văn học kinh điển và hiện đại' },
    { name: 'Khoa học', slug: 'khoa-hoc', description: 'Sách khoa học phổ thông và chuyên sâu' },
    { name: 'Kinh tế - Kinh doanh', slug: 'kinh-te-kinh-doanh', description: 'Sách về kinh tế, tài chính và quản trị' },
    { name: 'Tâm lý - Kỹ năng sống', slug: 'tam-ly-ky-nang-song', description: 'Phát triển bản thân và kỹ năng mềm' },
    { name: 'Lịch sử', slug: 'lich-su', description: 'Khám phá lịch sử thế giới và Việt Nam' },
    { name: 'Công nghệ', slug: 'cong-nghe', description: 'Sách về công nghệ và lập trình' },
    { name: 'Thiếu nhi', slug: 'thieu-nhi', description: 'Sách dành cho trẻ em và thiếu niên' },
    { name: 'Ngoại ngữ', slug: 'ngoai-ngu', description: 'Sách học ngoại ngữ' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('✅ Categories seeded');

  // Seed Authors - Các tác giả nổi tiếng thế giới và Việt Nam
  const authors = [
    // Tác giả Việt Nam
    {
      name: 'Nam Cao',
      slug: 'nam-cao',
      bio: 'Nhà văn hiện thực xuất sắc của Việt Nam, tác giả của "Chí Phèo", "Lão Hạc", "Đời thừa". Ông được coi là một trong những cây bút tiêu biểu nhất của văn học Việt Nam thế kỷ 20.',
    },
    {
      name: 'Nguyễn Du',
      slug: 'nguyen-du',
      bio: 'Đại thi hào dân tộc Việt Nam, tác giả của kiệt tác "Truyện Kiều". Ông được UNESCO vinh danh là Danh nhân văn hóa thế giới.',
    },
    {
      name: 'Nguyễn Nhật Ánh',
      slug: 'nguyen-nhat-anh',
      bio: 'Nhà văn Việt Nam nổi tiếng với các tác phẩm dành cho tuổi trẻ như "Mắt biếc", "Tôi thấy hoa vàng trên cỏ xanh", "Cho tôi xin một vé đi tuổi thơ".',
    },
    {
      name: 'Ngô Tất Tố',
      slug: 'ngo-tat-to',
      bio: 'Nhà văn hiện thực phê phán, tác giả của tiểu thuyết nổi tiếng "Tắt đèn" - tác phẩm phản ánh sâu sắc cuộc sống người nông dân Việt Nam trước Cách mạng.',
    },
    // Tác giả quốc tế
    {
      name: 'Haruki Murakami',
      slug: 'haruki-murakami',
      bio: 'Nhà văn Nhật Bản nổi tiếng thế giới với phong cách siêu thực độc đáo. Tác phẩm tiêu biểu: "Rừng Na Uy", "Kafka bên bờ biển", "1Q84".',
    },
    {
      name: 'Paulo Coelho',
      slug: 'paulo-coelho',
      bio: 'Nhà văn Brazil, tác giả của "Nhà giả kim" - cuốn sách bán chạy nhất mọi thời đại. Tác phẩm của ông đã được dịch ra hơn 80 ngôn ngữ.',
    },
    {
      name: 'Dale Carnegie',
      slug: 'dale-carnegie',
      bio: 'Nhà văn và diễn giả người Mỹ, tác giả của "Đắc nhân tâm" - cuốn sách self-help kinh điển đã bán hơn 30 triệu bản trên toàn thế giới.',
    },
    {
      name: 'Stephen Hawking',
      slug: 'stephen-hawking',
      bio: 'Nhà vật lý lý thuyết và vũ trụ học người Anh, tác giả của "Lược sử thời gian". Ông là một trong những nhà khoa học vĩ đại nhất của thế kỷ 20-21.',
    },
    {
      name: 'Yuval Noah Harari',
      slug: 'yuval-noah-harari',
      bio: 'Nhà sử học và giáo sư người Israel, tác giả của bộ ba bestseller "Sapiens", "Homo Deus" và "21 bài học cho thế kỷ 21".',
    },
    {
      name: 'Robert Kiyosaki',
      slug: 'robert-kiyosaki',
      bio: 'Doanh nhân và nhà đầu tư người Mỹ, tác giả của "Cha giàu cha nghèo" - cuốn sách tài chính cá nhân bán chạy nhất mọi thời đại.',
    },
    {
      name: 'Napoleon Hill',
      slug: 'napoleon-hill',
      bio: 'Nhà văn người Mỹ, tác giả của "Think and Grow Rich" (Nghĩ giàu làm giàu) - một trong những cuốn sách self-help có ảnh hưởng nhất mọi thời đại.',
    },
    {
      name: 'Gabriel García Márquez',
      slug: 'gabriel-garcia-marquez',
      bio: 'Nhà văn Colombia, đoạt giải Nobel Văn học 1982. Tác giả của kiệt tác "Trăm năm cô đơn" - đỉnh cao của chủ nghĩa hiện thực huyền ảo.',
    },
    {
      name: 'George Orwell',
      slug: 'george-orwell',
      bio: 'Nhà văn và nhà báo người Anh, tác giả của "1984" và "Trại súc vật" - những tác phẩm kinh điển về chủ nghĩa toàn trị.',
    },
    {
      name: 'Ernest Hemingway',
      slug: 'ernest-hemingway',
      bio: 'Nhà văn Mỹ đoạt giải Nobel Văn học 1954, nổi tiếng với phong cách viết ngắn gọn, súc tích. Tác phẩm tiêu biểu: "Ông già và biển cả".',
    },
    {
      name: 'Fyodor Dostoevsky',
      slug: 'fyodor-dostoevsky',
      bio: 'Nhà văn Nga vĩ đại, bậc thầy của tiểu thuyết tâm lý. Tác phẩm tiêu biểu: "Tội ác và hình phạt", "Anh em nhà Karamazov".',
    },
  ];

  for (const author of authors) {
    await prisma.author.upsert({
      where: { slug: author.slug },
      update: {},
      create: author,
    });
  }

  console.log('✅ Authors seeded');

  // Seed Users
  const hashedPassword = await bcrypt.hash('123456', 10);

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  const userRole = await prisma.role.findUnique({ where: { name: 'user' } });

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      username: 'admin',
      password: hashedPassword,
      signupMethod: SignupMethod.EMAIL,
    },
  });

  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRole.id },
    });
  }

  // Normal user
  const normalUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      username: 'user',
      password: hashedPassword,
      signupMethod: SignupMethod.EMAIL,
    },
  });

  if (userRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: normalUser.id, roleId: userRole.id } },
      update: {},
      create: { userId: normalUser.id, roleId: userRole.id },
    });
  }

  console.log('✅ Users seeded');

  // Sync Categories to Elasticsearch
  await syncCategoriesToElasticsearch();

  // Sync Authors to Elasticsearch
  await syncAuthorsToElasticsearch();

  // Sync Books to Elasticsearch
  await syncBooksToElasticsearch();

  console.log('🎉 Seed completed successfully!');
}

async function syncCategoriesToElasticsearch() {
  const indexName = 'categories';

  try {
    // Check if ES is available
    await esClient.ping();

    // Delete index if exists
    const indexExists = await esClient.indices.exists({ index: indexName });
    if (indexExists) {
      await esClient.indices.delete({ index: indexName });
    }

    // Create index with mappings (edge_ngram for autocomplete)
    await esClient.indices.create({
      index: indexName,
      settings: {
        analysis: {
          filter: {
            autocomplete_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20,
            },
          },
          analyzer: {
            vietnamese_standard: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
            autocomplete_index: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding', 'autocomplete_filter'],
            },
            autocomplete_search: {
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
            analyzer: 'vietnamese_standard',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_index',
                search_analyzer: 'autocomplete_search',
              },
            },
          },
          nameFirst: {
            type: 'text',
            analyzer: 'autocomplete_index',
            search_analyzer: 'autocomplete_search',
          },
          slug: { type: 'keyword' },
          description: { type: 'text', analyzer: 'vietnamese_standard' },
          parentId: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'date' },
        },
      },
    });

    // Get all categories from DB
    const categories = await prisma.category.findMany();

    if (categories.length > 0) {
      // Bulk index with nameFirst field
      const operations = categories.flatMap((cat) => [
        { index: { _index: indexName, _id: cat.id.toString() } },
        {
          id: cat.id,
          name: cat.name,
          nameFirst: cat.name.split(' ')[0],
          slug: cat.slug,
          description: cat.description,
          parentId: cat.parentId,
          isActive: cat.isActive,
          createdAt: cat.createdAt,
        },
      ]);

      await esClient.bulk({ operations });
    }

    console.log('✅ Categories synced to Elasticsearch');
  } catch (error) {
    console.warn('⚠️ Elasticsearch sync skipped (ES not available):', (error as Error).message);
  }
}

async function syncAuthorsToElasticsearch() {
  const indexName = 'authors';

  try {
    // Check if ES is available
    await esClient.ping();

    // Delete index if exists
    const indexExists = await esClient.indices.exists({ index: indexName });
    if (indexExists) {
      await esClient.indices.delete({ index: indexName });
    }

    // Create index with mappings (edge_ngram for autocomplete)
    await esClient.indices.create({
      index: indexName,
      settings: {
        analysis: {
          filter: {
            autocomplete_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20,
            },
          },
          analyzer: {
            vietnamese_standard: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
            autocomplete_index: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding', 'autocomplete_filter'],
            },
            autocomplete_search: {
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
            analyzer: 'vietnamese_standard',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_index',
                search_analyzer: 'autocomplete_search',
              },
            },
          },
          nameFirst: {
            type: 'text',
            analyzer: 'autocomplete_index',
            search_analyzer: 'autocomplete_search',
          },
          slug: { type: 'keyword' },
          bio: { type: 'text', analyzer: 'vietnamese_standard' },
          avatar: { type: 'keyword' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'date' },
        },
      },
    });

    // Get all authors from DB
    const authors = await prisma.author.findMany();

    if (authors.length > 0) {
      // Bulk index with nameFirst field
      const operations = authors.flatMap((author) => [
        { index: { _index: indexName, _id: author.id.toString() } },
        {
          id: author.id,
          name: author.name,
          nameFirst: author.name.split(' ')[0],
          slug: author.slug,
          bio: author.bio,
          avatar: author.avatar,
          isActive: author.isActive,
          createdAt: author.createdAt,
        },
      ]);

      await esClient.bulk({ operations });
    }

    console.log('✅ Authors synced to Elasticsearch');
  } catch (error) {
    console.warn('⚠️ Elasticsearch sync skipped (ES not available):', (error as Error).message);
  }
}

async function syncBooksToElasticsearch() {
  const indexName = 'books';

  try {
    // Check if ES is available
    await esClient.ping();

    // Delete index if exists
    const indexExists = await esClient.indices.exists({ index: indexName });
    if (indexExists) {
      await esClient.indices.delete({ index: indexName });
    }

    // Create index with mappings (edge_ngram for autocomplete)
    await esClient.indices.create({
      index: indexName,
      settings: {
        analysis: {
          filter: {
            autocomplete_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20,
            },
          },
          analyzer: {
            vietnamese_standard: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
            autocomplete_index: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding', 'autocomplete_filter'],
            },
            autocomplete_search: {
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
          title: {
            type: 'text',
            analyzer: 'vietnamese_standard',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_index',
                search_analyzer: 'autocomplete_search',
              },
            },
          },
          titleFirst: {
            type: 'text',
            analyzer: 'autocomplete_index',
            search_analyzer: 'autocomplete_search',
          },
          slug: { type: 'keyword' },
          description: { type: 'text', analyzer: 'vietnamese_standard' },
          coverImage: { type: 'keyword' },
          price: { type: 'float' },
          status: { type: 'keyword' },
          accessType: { type: 'keyword' },
          isActive: { type: 'boolean' },
          viewCount: { type: 'integer' },
          createdAt: { type: 'date' },
          categories: {
            type: 'nested',
            properties: {
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'vietnamese_standard' },
              slug: { type: 'keyword' },
            },
          },
          authors: {
            type: 'nested',
            properties: {
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'vietnamese_standard' },
              slug: { type: 'keyword' },
            },
          },
        },
      },
    });

    // Get all books with relations from DB
    const books = await prisma.book.findMany({
      include: {
        categories: { include: { category: true } },
        authors: { include: { author: true } },
      },
    });

    if (books.length > 0) {
      // Bulk index with titleFirst field
      const operations = books.flatMap((book) => [
        { index: { _index: indexName, _id: book.id.toString() } },
        {
          id: book.id,
          title: book.title,
          titleFirst: book.title.split(' ')[0],
          slug: book.slug,
          description: book.description,
          coverImage: book.coverImage,
          price: book.price ? Number(book.price) : null,
          status: book.status,
          accessType: book.accessType,
          isActive: book.isActive,
          viewCount: book.viewCount,
          createdAt: book.createdAt,
          categories: book.categories.map((c) => ({
            id: c.category.id,
            name: c.category.name,
            slug: c.category.slug,
          })),
          authors: book.authors.map((a) => ({
            id: a.author.id,
            name: a.author.name,
            slug: a.author.slug,
          })),
        },
      ]);

      await esClient.bulk({ operations });
    }

    console.log('✅ Books synced to Elasticsearch');
  } catch (error) {
    console.warn('⚠️ Elasticsearch sync skipped (ES not available):', (error as Error).message);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
