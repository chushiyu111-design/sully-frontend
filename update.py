import re
with open("utils/chatParser.ts", "r", encoding="utf8") as f:
    content = f.read()

content = re.sub(
    r"if\s*\(\s*content\.includes\('\[\[ACTION:POKE\]\]'\)\s*\)\s*\{[\s\S]*?content = content\.replace\('\[\[ACTION:POKE\]\]',\s*''\)\.trim\(\);\s*\}",
    """const pokeMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()(?:ACTION\\\\s*[:：]\\\\s*)?POKE(?:\\\\]{1,2}|】|\\\\))/i);
        if (pokeMatch) {
            await DB.saveMessage({ charId, role: 'assistant', type: 'interaction', content: '[戳一戳]' });
            content = content.replace(pokeMatch[0], '').trim();
        }""",
    content
)

content = re.sub(
    r"const transferMatch = content\.match\(/\\\[\\\[ACTION:TRANSFER:\(\\d\+\)\\\]\\\]/\);[\s\S]*?content = content\.replace\(transferMatch\[0\], ''\)\.trim\(\);\s*\}",
    """const transferMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*TRANSFER\\\\s*[:：]\\\\s*(\\\\d+)(?:\\\\]{1,2}|】|\\\\))/i);
        if (transferMatch) {
            await DB.saveMessage({ charId, role: 'assistant', type: 'transfer', content: '[转账]', metadata: { amount: transferMatch[1], status: 'pending' } });
            content = content.replace(transferMatch[0], '').trim();
        }""",
    content
)

content = re.sub(
    r"if\s*\(\s*content\.includes\('\[\[ACTION:RECEIVE_TRANSFER\]\]'\)\s*\)\s*\{[\s\S]*?content = content\.replace\('\[\[ACTION:RECEIVE_TRANSFER\]\]', ''\)\.trim\(\);\s*\}",
    """const receiveTransferMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*RECEIVE_TRANSFER(?:\\\\]{1,2}|】|\\\\))/i);
        if (receiveTransferMatch) {
            try {
                const recentMsgs = await DB.getRecentMessagesByCharId(charId, 50);
                const pendingUserTransfer = recentMsgs.slice().reverse().find(
                    m => m.role === 'user' && m.type === 'transfer' && m.metadata?.status === 'pending'
                );
                if (pendingUserTransfer) {
                    await DB.updateMessageMetadata(pendingUserTransfer.id, { status: 'accepted' });
                    addToast(`${charName} 已收取 ¥${pendingUserTransfer.metadata?.amount}`, 'success');
                }
            } catch (e) { console.error('RECEIVE_TRANSFER failed:', e); }
            content = content.replace(receiveTransferMatch[0], '').trim();
        }""",
    content
)

content = re.sub(
    r"if\s*\(\s*content\.includes\('\[\[ACTION:RETURN_TRANSFER\]\]'\)\s*\)\s*\{[\s\S]*?content = content\.replace\('\[\[ACTION:RETURN_TRANSFER\]\]', ''\)\.trim\(\);\s*\}",
    """const returnTransferMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*RETURN_TRANSFER(?:\\\\]{1,2}|】|\\\\))/i);
        if (returnTransferMatch) {
            try {
                const recentMsgs = await DB.getRecentMessagesByCharId(charId, 50);
                const pendingUserTransfer = recentMsgs.slice().reverse().find(
                    m => m.role === 'user' && m.type === 'transfer' && m.metadata?.status === 'pending'
                );
                if (pendingUserTransfer) {
                    await DB.updateMessageMetadata(pendingUserTransfer.id, { status: 'returned' });
                    addToast(`${charName} 退还了 ¥${pendingUserTransfer.metadata?.amount}`, 'info');
                }
            } catch (e) { console.error('RETURN_TRANSFER failed:', e); }
            content = content.replace(returnTransferMatch[0], '').trim();
        }""",
    content
)

content = re.sub(
    r"const eventMatch = content\.match\(/\\\[\\\[ACTION:ADD_EVENT\\\\s\*\\\|\\\\s\*\(\.\*\?\)\\\\s\*\\\|\\\\s\*\(\.\*\?\)\\\]\\\]/\);[\s\S]*?content = content\.replace\(eventMatch\[0\], ''\)\.trim\(\);\s*\}",
    """const eventMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*ADD_EVENT\\\\s*[|｜]\\\\s*(.*?)\\\\s*[|｜]\\\\s*(.*?)(?:\\\\]{1,2}|】|\\\\))/i);
        if (eventMatch) {
            const title = eventMatch[1].trim();
            const date = eventMatch[2].trim();
            if (title && date) {
                const anni: any = { id: `anni-${Date.now()}`, title: title, date: date, charId };
                await DB.saveAnniversary(anni);
                addToast(`${charName} 添加了新日程: ${title}`, 'success');
                await DB.saveMessage({ charId, role: 'system', type: 'text', content: `[系统: ${charName} 新增了日程 "${title}" (${date})]`, metadata: { source: 'schedule', scheduleEvent: 'add_event' } });
            }
            content = content.replace(eventMatch[0], '').trim();
        }""",
    content
)

with open("utils/chatParser.ts", "w", encoding="utf8") as f:
    f.write(content)

print("success")
