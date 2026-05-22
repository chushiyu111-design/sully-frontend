import { beforeEach,describe,expect,it,vi } from 'vitest';
import {
    connectGithubBackup,
    GITHUB_BACKUP_CONFIG_KEY,
    GitHubBackupConfig,
    listGithubBackups,
} from '../utils/githubBackup';

function jsonResponse(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('githubBackup', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('connects and creates a private backup repo when missing', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse(200, { login: 'tester' }))
            .mockResolvedValueOnce(jsonResponse(404, { message: 'Not Found' }))
            .mockResolvedValueOnce(jsonResponse(201, { name: 'sully-backup' }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await connectGithubBackup('ghp_token', 'sully-backup');

        expect(result.ok).toBe(true);
        expect(result.config?.owner).toBe('tester');
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            'https://api.github.com/user/repos',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"private":true'),
            }),
        );
        expect(localStorage.getItem(GITHUB_BACKUP_CONFIG_KEY)).toContain('ghp_token');
    });

    it('groups multipart release assets into one restore entry', async () => {
        const config: GitHubBackupConfig = {
            token: 'ghp_token',
            owner: 'tester',
            repo: 'sully-backup',
            connectedAt: 1,
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [
            {
                id: 10,
                tag_name: 'sully-backup-1',
                created_at: '2026-05-22T00:00:00.000Z',
                html_url: 'https://github.com/tester/sully-backup/releases/tag/sully-backup-1',
                assets: [
                    { id: 2, name: 'Sully_Backup_full_1.part02of02.zip', size: 4, updated_at: '2026-05-22T00:00:02.000Z' },
                    { id: 1, name: 'Sully_Backup_full_1.part01of02.zip', size: 3, updated_at: '2026-05-22T00:00:01.000Z' },
                ],
            },
        ])));

        const files = await listGithubBackups(config);

        expect(files).toHaveLength(1);
        expect(files[0]).toMatchObject({
            name: 'Sully_Backup_full_1.zip',
            size: 7,
            href: '10:1,2',
        });
    });
});
