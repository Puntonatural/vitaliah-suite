async function sendCard(webhookUrl, title, subtitle, sections) {
  const widgets = [];
  for (const section of sections) {
    if (section.type === 'text') {
      widgets.push({ textParagraph: { text: section.content } });
    } else if (section.type === 'kv') {
      widgets.push({
        decoratedText: {
          topLabel: section.label,
          text: section.value,
          ...(section.icon ? { startIcon: { knownIcon: section.icon } } : {})
        }
      });
    } else if (section.type === 'divider') {
      widgets.push({ divider: {} });
    } else if (section.type === 'button') {
      widgets.push({
        buttonList: {
          buttons: [{
            text: section.label,
            onClick: { openLink: { url: section.url } }
          }]
        }
      });
    }
  }

  const card = {
    cardsV2: [{
      cardId: 'alert-' + Date.now(),
      card: {
        header: {
          title,
          subtitle,
          imageUrl: 'https://i.imgur.com/7mFGVXk.png',
          imageType: 'CIRCLE'
        },
        sections: [{ widgets }]
      }
    }]
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Chat error ${res.status}: ${text}`);
  }
  return true;
}

async function sendText(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error(`Google Chat error ${res.status}`);
  return true;
}

module.exports = { sendCard, sendText };
