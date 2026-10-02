import {
  departments,
  locations,
  positions,
  qualifications,
} from "@/lib/demo/data";
import { getDemoState } from "@/lib/demo/store";
import { isDatabaseMode } from "@/lib/env";
import { userFacingDatabaseError } from "@/lib/phase7/domain";
import {
  loadWorkforce,
  saveWorkforce,
} from "@/lib/db/neon";
import type {
  Department,
  Location,
  Position,
  Qualification,
} from "@/types";

type DemoState = ReturnType<typeof getDemoState>;

export type WorkforceState = DemoState & {
  locations: Location[];
  departments: Department[];
  positions: Position[];
  qualifications: Qualification[];
};

function demoWorkforce(): WorkforceState {
  return {
    ...getDemoState(),
    locations,
    departments,
    positions,
    qualifications,
  };
}

export async function readWorkforceState(organizationId?: string): Promise<WorkforceState> {
  if (!isDatabaseMode()) return demoWorkforce();
  return (await loadWorkforce(organizationId)).state;
}

export async function mutateWorkforceState<T>(
  mutate: (state: WorkforceState) => T,
  organizationId?: string,
): Promise<T> {
  if (!isDatabaseMode()) return mutate(demoWorkforce());

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const loaded = await loadWorkforce(organizationId);
      const result = mutate(loaded.state);
      const saved = await saveWorkforce(loaded.state, loaded.version, organizationId);
      if (saved) return result;
    }
    throw new Error("Could not save changes. Please retry.");
  } catch (error) {
    const friendly = userFacingDatabaseError(error);
    if (friendly) throw new Error(friendly);
    throw error;
  }
}
