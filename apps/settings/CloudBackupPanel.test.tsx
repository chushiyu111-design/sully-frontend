import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CloudBackupPanel from './CloudBackupPanel';
import {
    getLatestCloudBackup,
    isCloudBackupAvailable,
    uploadCloudBackup,
} from '../../utils/cloudBackup';
import { readSystemBackupIncludeVoiceAudio } from '../../utils/systemBackup';

const mocks = vi.hoisted(() => ({
    exportSystem: vi.fn(),
    importSystem: vi.fn(),
    addToast: vi.fn(),
}));

vi.mock('../../context/OSContext', () => ({
    useOS: () => ({
        exportSystem: mocks.exportSystem,
        importSystem: mocks.importSystem,
        addToast: mocks.addToast,
        sysOperation: { status: 'idle' },
    }),
}));

vi.mock('../../utils/cloudBackup', () => ({
    CLOUD_BACKUP_MAX_DISPLAY: '约100MB',
    assertCloudBackupUploadSize: vi.fn(),
    downloadCloudBackup: vi.fn(),
    getLatestCloudBackup: vi.fn(),
    isCloudBackupAvailable: vi.fn(),
    uploadCloudBackup: vi.fn(),
}));

vi.mock('../../utils/githubBackup', () => ({
    DEFAULT_GITHUB_BACKUP_REPO: 'sully-backup',
    cleanupOldGithubBackups: vi.fn(),
    clearGithubBackupConfig: vi.fn(),
    connectGithubBackup: vi.fn(),
    downloadGithubBackup: vi.fn(),
    getLatestGithubBackup: vi.fn(),
    listGithubBackups: vi.fn(),
    readGithubBackupConfig: vi.fn(() => null),
    uploadGithubBackup: vi.fn(),
}));

vi.mock('../../utils/systemBackup', () => ({
    readSystemBackupIncludeVoiceAudio: vi.fn(),
}));

describe('CloudBackupPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isCloudBackupAvailable).mockResolvedValue(true);
        vi.mocked(getLatestCloudBackup).mockResolvedValue(null);
        vi.mocked(uploadCloudBackup).mockResolvedValue({
            key: 'user/backup.zip',
            size: 3,
            uploaded: '2026-05-15T00:00:00.000Z',
        });
        vi.mocked(readSystemBackupIncludeVoiceAudio).mockReturnValue(true);
        mocks.exportSystem.mockResolvedValue(new Blob(['zip']));
    });

    it('creates manual cloud backups without memory record song audio', async () => {
        render(<CloudBackupPanel />);

        fireEvent.click(await screen.findByRole('button', { name: /立即备份到云端/ }));

        await waitFor(() => expect(uploadCloudBackup).toHaveBeenCalledTimes(1));
        expect(mocks.exportSystem).toHaveBeenCalledWith('full', {
            includeVoiceAudio: true,
            includeMemoryRecordAudio: false,
        });
        expect(mocks.addToast).toHaveBeenCalledWith(
            expect.stringContaining('不含歌曲音频'),
            'info',
        );
    }, 10000);
});
