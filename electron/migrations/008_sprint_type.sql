-- 008: Sprint 類型支援動態關卡
-- full: G0-G5 全部, feature: G0+G2+G3+G4, bugfix: G2+G3+G4, release: G4+G5
ALTER TABLE sprints ADD COLUMN sprint_type TEXT NOT NULL DEFAULT 'full';
