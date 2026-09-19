import { Bug } from "../models/Bug.js";
import { TestResult } from "../models/TestResult.js";
import { ApiRequest } from "../models/ApiRequest.js";
import { ConsoleLog } from "../models/ConsoleLog.js";
import { Screenshot } from "../models/Screenshot.js";
import { TestCase } from "../models/TestCase.js";
import { Project } from "../models/Project.js";
import { notFound } from "../utils/AppError.js";

export class BugService {
  async list(projectId: string, filters: { status?: string; severity?: string }) {
    const query: Record<string, unknown> = { projectId };
    if (filters.status) query.status = filters.status;
    if (filters.severity) query.severity = filters.severity;
    return Bug.find(query).sort({ createdAt: -1 }).lean();
  }

  async get(bugId: string) {
    const bug = await Bug.findById(bugId).lean();
    if (!bug) throw notFound("Bug not found");
    const [relatedTests, relatedApis, consoleLogs, screenshots, relatedBugs] = await Promise.all([
      TestCase.find({ _id: { $in: bug.relatedTests } }).lean(),
      ApiRequest.find({ _id: { $in: [...bug.relatedApiRequests, ...bug.evidence.apiRequestIds] } }).lean(),
      ConsoleLog.find({ _id: { $in: bug.evidence.consoleLogIds } }).lean(),
      Screenshot.find({ _id: { $in: bug.evidence.screenshotIds } }).lean(),
      Bug.find({
        projectId: bug.projectId,
        $or: [{ duplicateOf: bug._id }, { _id: bug.duplicateOf }, { page: { url: bug.page.url } }],
      })
        .select("bugKey title status severity")
        .lean(),
    ]);
    const results = await TestResult.find({ testCaseId: { $in: bug.relatedTests } }).lean();
    return {
      ...bug,
      relatedTestDetails: relatedTests,
      relatedApiDetails: relatedApis,
      consoleLogs,
      screenshots,
      relatedBugs: relatedBugs.filter((item) => String(item._id) !== String(bug._id)),
      relatedResults: results,
    };
  }

  async update(bugId: string, input: { status?: string; severity?: string; priority?: string; duplicateOf?: string }) {
    const bug = await Bug.findById(bugId);
    if (!bug) throw notFound("Bug not found");
    if (input.status) bug.status = input.status as typeof bug.status;
    if (input.severity) bug.severity = input.severity as typeof bug.severity;
    if (input.priority) bug.priority = input.priority as typeof bug.priority;
    if (input.duplicateOf) {
      bug.duplicateOf = input.duplicateOf as unknown as typeof bug.duplicateOf;
      bug.status = "duplicate";
    }
    await bug.save();
    return bug.toObject();
  }

  async nextBugKey(projectId: string) {
    const project = await Project.findByIdAndUpdate(projectId, { $inc: { bugSequence: 1 } }, { new: true });
    const seq = project?.bugSequence ?? 1;
    return `BUG-${String(seq).padStart(3, "0")}`;
  }
}

export const bugService = new BugService();
