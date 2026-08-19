import { useEffect, useRef, useState } from 'react';
import type { VpsStatus } from '../api/client';
import { deleteVps, importVps } from '../api/client';
import { parseVpsImport } from '../utils/vpsImport';
import {
  CheckIcon,
  CopyIcon,
  EditIcon,
  PlusIcon,
  RefreshIcon,
  SettingsIcon,
  TrashIcon,
  UploadIcon,
} from './icons';
import VpsAddModal from './VpsAddModal';
import Modal from './Modal';
import IconButton from './IconButton';
import Tooltip from './Tooltip';
import { availabilityState, overallAvailability, vpsAvailability } from '../utils/availability';
import { useAuth } from '../hooks/useAuth';

/** Состояние импорта VPS из JSON-файла. */
type ImportState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'importing' }
  | { status: 'done'; imported: number; skipped: number; errors: string[] }
  | { status: 'error'; message: string };

interface VpsDetailsModalProps {
  /** Сырые статусы VPS для детализации */
  statuses: VpsStatus[];
  onClose: () => void;
  /** Принудительно перепроверить статусы VPS */
  onRefresh?: () => void;
  /** Идёт ли сейчас обновление */
  refreshing?: boolean;
}

function VpsDetailsModal({
  statuses,
  onClose,
  onRefresh,
  refreshing = false,
}: VpsDetailsModalProps) {
  const overall = overallAvailability(statuses);
  // Управление VPS (добавление/импорт/удаление) — только для admin.
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const copyTimerRef = useRef<number | null>(null);
  const importTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Копирование IP в буфер обмена с кратковременной «галочкой».
  const copyIp = (ip: string) => {
    void navigator.clipboard
      .writeText(ip)
      .then(() => {
        setCopiedIp(ip);
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopiedIp(null), 1500);
      })
      .catch(() => undefined);
  };

  // Удаление VPS с подтверждением; после успеха — принудительная перепроверка.
  const handleDelete = async (name: string) => {
    if (!window.confirm(`Удалить VPS «${name}»?`)) return;
    setDeleting(name);
    setDeleteError(null);
    try {
      await deleteVps(name);
      onRefresh?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить VPS');
    } finally {
      setDeleting(null);
    }
  };

  // Сброс таймеров при размонтировании.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (importTimerRef.current !== null) window.clearTimeout(importTimerRef.current);
    };
  }, []);

  // Импорт VPS из JSON-файла (структура как в vps.json).
  const handleImportFile = async (file: File) => {
    setImportState({ status: 'reading' });
    try {
      const text = await file.text();
      const parsed = parseVpsImport(text);
      if (parsed.entries.length === 0) {
        setImportState({
          status: 'error',
          message: 'В файле нет корректных записей VPS',
        });
        return;
      }
      setImportState({ status: 'importing' });
      const result = await importVps({ vps: parsed.entries });
      setImportState({
        status: 'done',
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
      onRefresh?.();
    } catch (err) {
      setImportState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Не удалось импортировать VPS',
      });
    } finally {
      // Позволяет повторно выбрать тот же файл.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // Автоскрытие результата через несколько секунд.
    if (importTimerRef.current !== null) window.clearTimeout(importTimerRef.current);
    importTimerRef.current = window.setTimeout(() => {
      setImportState({ status: 'idle' });
    }, 6000);
  };

  // Закрытие по Escape обрабатывает базовый Modal (при открытой форме добавления
  // вместо этой модалки рендерится VpsAddModal со своим обработчиком).

  // VPS добавлен — вернуться к списку и принудительно перепроверить (обход кэша).
  const handleAdded = () => {
    setAdding(false);
    onRefresh?.();
  };

  const editingEntry = editingName ? statuses.find((entry) => entry.name === editingName) : null;

  // Форма добавления/редактирования VPS заменяет содержимое модалки.
  if (adding) {
    return <VpsAddModal onClose={() => setAdding(false)} onAdded={handleAdded} />;
  }
  if (editingEntry) {
    return (
      <VpsAddModal
        mode="edit"
        initialEntry={editingEntry}
        currentName={editingEntry.name}
        onClose={() => setEditingName(null)}
        onAdded={handleAdded}
      />
    );
  }

  // Кнопки-иконки в шапке модалки: «+» (добавить), импорт из JSON, «Обновить».
  const modalActions = (
    <>
      {isAdmin && (
        <IconButton label="Добавить VPS" tooltip="Добавить VPS" onClick={() => setAdding(true)}>
          <PlusIcon />
        </IconButton>
      )}
      {isAdmin && (
        <IconButton
          label="Импорт из JSON"
          tooltip="Импорт VPS из JSON-файла"
          onClick={() => fileInputRef.current?.click()}
          disabled={importState.status === 'reading' || importState.status === 'importing'}
        >
          <UploadIcon />
        </IconButton>
      )}
      {onRefresh && (
        <IconButton
          label="Обновить"
          tooltip="Обновить"
          spinning={refreshing}
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshIcon />
        </IconButton>
      )}
    </>
  );

  return (
    <Modal title="Доступность VPS" wide onClose={onClose} actions={modalActions}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />

      <div className="modal__summary">
        Общая доступность: <strong>{Math.round(overall * 100)}%</strong>
      </div>

      {importState.status !== 'idle' && (
        <div
          className={`modal__import-note${
            importState.status === 'done'
              ? ' modal__import-note--ok'
              : importState.status === 'error'
                ? ' modal__import-note--error'
                : ''
          }`}
          role="status"
        >
          {importState.status === 'reading' && 'Чтение файла…'}
          {importState.status === 'importing' && 'Импорт…'}
          {importState.status === 'done' && (
            <>
              Импортировано: <strong>{importState.imported}</strong>
              {importState.skipped > 0 && (
                <>
                  {'; '}пропущено: <strong>{importState.skipped}</strong>
                </>
              )}
              {importState.errors.length > 0 && (
                <ul className="modal__import-errors">
                  {importState.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {importState.status === 'error' && importState.message}
        </div>
      )}

      {deleteError && (
        <div className="modal__import-note modal__import-note--error" role="alert">
          {deleteError}
        </div>
      )}

      <div className="modal__list">
        {statuses.map((vps) => {
          const availability = vpsAvailability(vps);
          const state = availabilityState(Math.round(availability.total * 100));
          return (
            <div className="modal__vps" key={vps.name}>
              <img
                className="modal__vps-flag"
                src={`https://flagcdn.com/${vps.country.toLowerCase()}.svg`}
                alt={`Флаг: ${vps.country}`}
                width={24}
                height={16}
              />
              <div className="modal__vps-head">
                <span className="modal__vps-name">{vps.name}</span>
                <span className={`modal__vps-percent modal__vps-percent--${state}`}>
                  {Math.round(availability.total * 100)}%
                </span>
                <span className="modal__vps-head-actions">
                  {vps.panel && (
                    <Tooltip content="Панель управления хостера">
                      <a
                        className="icon-btn icon-btn--sm icon-btn--plain"
                        href={vps.panel}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Панель управления хостера"
                      >
                        <SettingsIcon />
                      </a>
                    </Tooltip>
                  )}
                  {isAdmin && (
                    <IconButton
                      size="sm"
                      plain
                      label="Редактировать VPS"
                      tooltip="Редактировать VPS"
                      onClick={() => setEditingName(vps.name)}
                    >
                      <EditIcon />
                    </IconButton>
                  )}
                  {isAdmin && (
                    <IconButton
                      size="sm"
                      plain
                      danger
                      label="Удалить VPS"
                      tooltip="Удалить VPS"
                      onClick={() => handleDelete(vps.name)}
                      disabled={deleting === vps.name}
                    >
                      <TrashIcon />
                    </IconButton>
                  )}
                </span>
              </div>
              <div className="modal__vps-ip-row">
                <span className="modal__vps-ip">{vps.ip}</span>
                <IconButton
                  size="sm"
                  plain
                  active={copiedIp === vps.ip}
                  label="Скопировать IP"
                  tooltip={copiedIp === vps.ip ? 'Скопировано' : 'Скопировать IP'}
                  onClick={() => copyIp(vps.ip)}
                >
                  {copiedIp === vps.ip ? <CheckIcon /> : <CopyIcon />}
                </IconButton>
              </div>
              <ul className="modal__services">
                {vps.services.length > 0 ? (
                  vps.services.map((service) => (
                    <li key={service.name} className="modal__service">
                      <span
                        className={`modal__service-dot modal__service-dot--${
                          service.online ? 'ok' : 'error'
                        }`}
                        title={service.online ? 'доступен' : 'недоступен'}
                      />
                      {service.type === 'http' ? (
                        <a
                          className="modal__service-name"
                          href={service.address}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={service.address}
                        >
                          {service.name}
                        </a>
                      ) : (
                        <span className="modal__service-name" title={service.address}>
                          {service.name}
                        </span>
                      )}
                      <span className="modal__service-latency">
                        {service.latencyMs != null ? `${Math.round(service.latencyMs)} мс` : '—'}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="modal__service modal__service--muted">Сервисы не настроены</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export default VpsDetailsModal;
