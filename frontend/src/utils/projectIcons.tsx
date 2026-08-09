import type { ComponentType } from 'react';
import { FolderIcon, ProjectsIcon, RenovationIcon, type IconProps } from '../components/icons';

/**
 * Иконки проектов по имени из `project-icon` (карточка/страница проекта,
 * модалки создания и редактирования). Неизвестное имя → иконка по умолчанию.
 */
export const projectIcons: Record<string, ComponentType<IconProps>> = {
  renovation: RenovationIcon,
  folder: FolderIcon,
  projects: ProjectsIcon,
};
