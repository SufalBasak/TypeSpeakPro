import React from 'react';
import { useInterview } from '@/context/InterviewContext';
import { FeedbackScores, InterviewSummary } from '@/types/hr-interview';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Home,
  Download,
  Share2,
  CheckCircle,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './Logo';

interface SummaryReportProps {
  onRestart: () => void;
  onHome: () => void;
}

const SummaryReport: React.FC<SummaryReportProps> = ({ onRestart, onHome }) => {
  const { session } = useInterview();

  if (!session) return null;

  // Calculate summary
  const calculateSummary = (): InterviewSummary => {
    const answers = session.answers;
    const totalQuestions = answers.length;

    if (totalQuestions === 0) {
      return {
        totalQuestions: 0,
        averageScores: { grammar: 0, fluency: 0, confidence: 0, relevance: 0 },
        strongAreas: [],
        weakAreas: [],
        overallScore: 0,
        duration: 0,
      };
    }

    const avgScores: FeedbackScores = {
      grammar: answers.reduce((sum, a) => sum + a.scores.grammar, 0) / totalQuestions,
      fluency: answers.reduce((sum, a) => sum + a.scores.fluency, 0) / totalQuestions,
      confidence: answers.reduce((sum, a) => sum + a.scores.confidence, 0) / totalQuestions,
      relevance: answers.reduce((sum, a) => sum + a.scores.relevance, 0) / totalQuestions,
    };

    const scoreEntries = Object.entries(avgScores) as [keyof FeedbackScores, number][];
    const strongAreas = scoreEntries.filter(([, score]) => score >= 7).map(([key]) => key);
    const weakAreas = scoreEntries.filter(([, score]) => score < 6).map(([key]) => key);

    const overallScore = (avgScores.grammar + avgScores.fluency + avgScores.confidence + avgScores.relevance) / 4;
    const duration = Math.round((Date.now() - session.startTime.getTime()) / 60000);

    return {
      totalQuestions,
      averageScores: avgScores,
      strongAreas,
      weakAreas,
      overallScore,
      duration,
    };
  };

  const summary = calculateSummary();

  const getGrade = (score: number) => {
    if (score >= 9) return { grade: 'A+', color: 'text-success' };
    if (score >= 8) return { grade: 'A', color: 'text-success' };
    if (score >= 7) return { grade: 'B+', color: 'text-primary' };
    if (score >= 6) return { grade: 'B', color: 'text-primary' };
    if (score >= 5) return { grade: 'C', color: 'text-warning' };
    return { grade: 'D', color: 'text-destructive' };
  };

  const gradeInfo = getGrade(summary.overallScore);

  const formatSkillName = (skill: string) => {
    return skill.charAt(0).toUpperCase() + skill.slice(1);
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Logo size="lg" />
          <h1 className="font-heading text-4xl font-bold mt-8 mb-2 text-foreground">
            Interview Complete! 🎉
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's your performance summary
          </p>
        </div>

        {/* Overall Score Card */}
        <div className="card-elevated p-8 text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-warning" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Overall Performance
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 mb-6">
            <div>
              <span className={cn('font-heading text-7xl font-bold', gradeInfo.color)}>
                {gradeInfo.grade}
              </span>
            </div>
            <div className="text-left">
              <p className="font-heading text-4xl font-bold text-foreground">
                {summary.overallScore.toFixed(1)}<span className="text-xl text-muted-foreground">/10</span>
              </p>
              <p className="text-sm text-muted-foreground">Average Score</p>
            </div>
          </div>

          <div className="flex justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{summary.totalQuestions}</span> Questions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{summary.duration}</span> Minutes
              </span>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="card-elevated p-6 mb-8">
          <h2 className="font-heading font-semibold text-lg mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Detailed Scores
          </h2>

          <div className="space-y-4">
            {(Object.entries(summary.averageScores) as [keyof FeedbackScores, number][]).map(([skill, score]) => (
              <div key={skill as string}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-foreground">{formatSkillName(skill as string)}</span>
                  <span className="font-heading font-bold text-foreground">{score.toFixed(1)}/10</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${score * 10}%`,
                      background: score >= 7 ? 'var(--gradient-success)' : score >= 5 ? 'var(--gradient-hero)' : 'hsl(var(--warning))',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Areas for Improvement */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div className="card-elevated p-6">
            <h3 className="font-heading font-semibold mb-4 flex items-center gap-2 text-success">
              <CheckCircle className="w-5 h-5" />
              Strong Areas
            </h3>
            {summary.strongAreas.length > 0 ? (
              <ul className="space-y-2">
                {summary.strongAreas.map((area) => (
                  <li key={area} className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    {formatSkillName(area)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Keep practicing to develop your strengths!</p>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="card-elevated p-6">
            <h3 className="font-heading font-semibold mb-4 flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Areas to Improve
            </h3>
            {summary.weakAreas.length > 0 ? (
              <ul className="space-y-2">
                {summary.weakAreas.map((area) => (
                  <li key={area} className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    {formatSkillName(area)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Great job! All areas are performing well.</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={onRestart} variant="hero" size="lg">
            <RefreshCw className="w-5 h-5 mr-2" />
            Practice Again
          </Button>
          <Button onClick={onHome} variant="outline" size="lg">
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>

        {/* Secondary actions */}
        <div className="flex justify-center gap-4 mt-6">
          <Button variant="ghost" size="sm" disabled>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <Share2 className="w-4 h-4 mr-2" />
            Share Result
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          PDF download & sharing coming soon!
        </p>
      </div>
    </div>
  );
};

export default SummaryReport;
