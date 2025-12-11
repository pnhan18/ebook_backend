import { PrismaClient, SignupMethod } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
    {
      name: 'Văn học',
      slug: 'van-hoc',
      description: 'Các tác phẩm văn học kinh điển và hiện đại',
      children: [
        { name: 'Tiểu thuyết', slug: 'tieu-thuyet', description: 'Truyện dài hư cấu' },
        { name: 'Truyện ngắn', slug: 'truyen-ngan', description: 'Tập truyện ngắn' },
        { name: 'Thơ', slug: 'tho', description: 'Tuyển tập thơ ca' },
      ],
    },
    {
      name: 'Khoa học',
      slug: 'khoa-hoc',
      description: 'Sách khoa học phổ thông và chuyên sâu',
      children: [
        { name: 'Vật lý', slug: 'vat-ly', description: 'Khám phá vũ trụ và vật chất' },
        { name: 'Sinh học', slug: 'sinh-hoc', description: 'Thế giới sự sống' },
        { name: 'Thiên văn học', slug: 'thien-van-hoc', description: 'Khám phá vũ trụ' },
      ],
    },
    {
      name: 'Kinh tế - Kinh doanh',
      slug: 'kinh-te-kinh-doanh',
      description: 'Sách về kinh tế, tài chính và quản trị',
      children: [
        { name: 'Quản trị', slug: 'quan-tri', description: 'Kỹ năng lãnh đạo và quản lý' },
        { name: 'Đầu tư', slug: 'dau-tu', description: 'Chiến lược đầu tư tài chính' },
        { name: 'Khởi nghiệp', slug: 'khoi-nghiep', description: 'Hướng dẫn khởi nghiệp' },
      ],
    },
    {
      name: 'Tâm lý - Kỹ năng sống',
      slug: 'tam-ly-ky-nang-song',
      description: 'Phát triển bản thân và kỹ năng mềm',
      children: [
        { name: 'Tâm lý học', slug: 'tam-ly-hoc', description: 'Hiểu về tâm lý con người' },
        { name: 'Phát triển bản thân', slug: 'phat-trien-ban-than', description: 'Hoàn thiện chính mình' },
        { name: 'Giao tiếp', slug: 'giao-tiep', description: 'Nghệ thuật giao tiếp' },
      ],
    },
    {
      name: 'Lịch sử',
      slug: 'lich-su',
      description: 'Khám phá lịch sử thế giới và Việt Nam',
      children: [
        { name: 'Lịch sử Việt Nam', slug: 'lich-su-viet-nam', description: 'Lịch sử dân tộc' },
        { name: 'Lịch sử thế giới', slug: 'lich-su-the-gioi', description: 'Lịch sử các nền văn minh' },
        { name: 'Nhân vật lịch sử', slug: 'nhan-vat-lich-su', description: 'Tiểu sử các nhân vật nổi tiếng' },
      ],
    },
    {
      name: 'Công nghệ',
      slug: 'cong-nghe',
      description: 'Sách về công nghệ và lập trình',
      children: [
        { name: 'Lập trình', slug: 'lap-trinh', description: 'Học lập trình từ cơ bản đến nâng cao' },
        { name: 'Trí tuệ nhân tạo', slug: 'tri-tue-nhan-tao', description: 'AI và Machine Learning' },
        { name: 'Blockchain', slug: 'blockchain', description: 'Công nghệ chuỗi khối' },
      ],
    },
  ];

  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
    });

    if (cat.children) {
      for (const child of cat.children) {
        await prisma.category.upsert({
          where: { slug: child.slug },
          update: {},
          create: {
            name: child.name,
            slug: child.slug,
            description: child.description,
            parentId: parent.id,
          },
        });
      }
    }
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
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
