// bot/index.js
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://yourdomain.com';

// /start command
bot.start(async (ctx) => {
  const user = ctx.from;
  const name = user.first_name || user.username || 'игрок';

  await ctx.replyWithPhoto(
    { url: 'https://i.imgur.com/chess3d_preview.jpg' },
    {
      caption: `♟️ *3D Chess* — шахматы нового поколения!\n\nПривет, ${name}!\n\n` +
        `🎮 *Режимы игры:*\n` +
        `• Против ИИ (3 уровня)\n` +
        `• Мультиплеер с друзьями\n\n` +
        `🏆 *Рейтинговые партии* с ELO-системой\n` +
        `🌌 *3D доска* с Three.js\n` +
        `🎨 *3 темы* оформления\n\n` +
        `Нажми кнопку ниже, чтобы начать:`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('♟️ Играть в 3D Chess', WEBAPP_URL)],
        [Markup.button.callback('📊 Моя статистика', 'my_stats')],
        [Markup.button.callback('🏆 Таблица лидеров', 'leaderboard')]
      ])
    }
  ).catch(() => {
    // Fallback without photo
    ctx.reply(
      `♟️ *3D Chess* — шахматы нового поколения!\n\nПривет, ${name}! Нажми кнопку ниже:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('♟️ Играть в 3D Chess', WEBAPP_URL)],
          [Markup.button.callback('📊 Моя статистика', 'my_stats')],
          [Markup.button.callback('🏆 Таблица лидеров', 'leaderboard')]
        ])
      }
    );
  });
});

// /play command - direct WebApp button
bot.command('play', async (ctx) => {
  await ctx.reply('Открываю 3D Chess...', {
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('♟️ Открыть игру', WEBAPP_URL)]
    ])
  });
});

// Stats callback
bot.action('my_stats', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  try {
    const res = await fetch(`${WEBAPP_URL}/api/player/${userId}`);
    const stats = await res.json();

    if (stats.error) {
      return ctx.reply('Вы ещё не играли. Начните первую партию!');
    }

    const winRate = stats.wins + stats.losses + stats.draws > 0
      ? Math.round(stats.wins / (stats.wins + stats.losses + stats.draws) * 100)
      : 0;

    await ctx.reply(
      `📊 *Ваша статистика*\n\n` +
      `👤 ${stats.first_name || stats.username}\n` +
      `⭐ Рейтинг ELO: *${stats.elo}*\n\n` +
      `✅ Победы: ${stats.wins}\n` +
      `❌ Поражения: ${stats.losses}\n` +
      `🤝 Ничьи: ${stats.draws}\n` +
      `📈 Процент побед: ${winRate}%`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    ctx.reply('Не удалось загрузить статистику.');
  }
});

// Leaderboard callback
bot.action('leaderboard', async (ctx) => {
  await ctx.answerCbQuery();

  try {
    const res = await fetch(`${WEBAPP_URL}/api/leaderboard`);
    const leaders = await res.json();

    if (!leaders.length) {
      return ctx.reply('Таблица лидеров пуста. Станьте первым!');
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const text = leaders.map((p, i) =>
      `${medals[i]} *${p.first_name || p.username || 'Аноним'}* — ${p.elo} ELO (${p.wins}W/${p.losses}L)`
    ).join('\n');

    await ctx.reply(`🏆 *Таблица лидеров*\n\n${text}`, { parse_mode: 'Markdown' });
  } catch (e) {
    ctx.reply('Не удалось загрузить таблицу лидеров.');
  }
});

// /help command
bot.help((ctx) => {
  ctx.reply(
    `♟️ *3D Chess — Помощь*\n\n` +
    `/start — Главное меню\n` +
    `/play — Запустить игру\n` +
    `/help — Эта справка\n\n` +
    `*Управление в игре:*\n` +
    `• Нажми на фигуру, чтобы выбрать её\n` +
    `• Нажми на подсвеченную клетку, чтобы походить\n` +
    `• Используй кнопки смены темы и режима\n\n` +
    `*Режимы:*\n` +
    `🤖 Против ИИ — 3 уровня сложности\n` +
    `👥 Мультиплеер — быстрый матчмейкинг`,
    { parse_mode: 'Markdown' }
  );
});

// Handle WebApp data (if sent from client)
bot.on('web_app_data', async (ctx) => {
  const data = ctx.webAppData?.data;
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'game_result') {
        const result = parsed.winner ? `Победитель: ${parsed.winner}` : 'Ничья';
        await ctx.reply(`🎉 Партия завершена! ${result}`);
      }
    } catch {}
  }
});

// Launch bot
if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
  bot.launch({ webhook: { domain: process.env.WEBHOOK_URL, port: process.env.BOT_PORT || 8443 } });
} else {
  bot.launch();
  console.log('🤖 Bot started in polling mode');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
