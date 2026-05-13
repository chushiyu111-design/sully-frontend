with open("utils/chatParser.ts", "r", encoding="utf8") as f:
    content = f.read()

target = """            // 3d. Bracket normalization: [SEND_EMOJI: xxx] 【SEND_EMOJI：xxx】→ [[SEND_EMOJI: xxx]]
            .replace(/(?:\[{1,2}|【)\s*SEND_EMOJI\s*[：:]\s*([\s\S]*?)\s*(?:\]{1,2}|】)/gi, '[[SEND_EMOJI: $1]]')"""

replacement = """            // 3d. Bracket normalization: [SEND_EMOJI: xxx] 【SEND_EMOJI：xxx】→ [[SEND_EMOJI: xxx]]
            .replace(/(?:\[{1,2}|【)\s*SEND_EMOJI\s*[：:]\s*([\s\S]*?)\s*(?:\]{1,2}|】)/gi, '[[SEND_EMOJI: $1]]')

            // 3e. ACTION normalization: [发送转账: 50] -> [[ACTION:TRANSFER:50]], [戳一戳] -> [[ACTION:POKE]]
            .replace(/[【\[](?:发送)?转账\s*[：:]\s*(\d+)[】\]]/g, '[[ACTION:TRANSFER:$1]]')
            .replace(/[【\[](?:发送)?戳一戳[】\]]/g, '[[ACTION:POKE]]')
            .replace(/[【\[](?:收取|接收)转账[】\]]/g, '[[ACTION:RECEIVE_TRANSFER]]')
            .replace(/[【\[]退还转账[】\]]/g, '[[ACTION:RETURN_TRANSFER]]')"""

content = content.replace(target, replacement)

with open("utils/chatParser.ts", "w", encoding="utf8") as f:
    f.write(content)

print("success")
