import OpenAI from 'openai';

export type Message = OpenAI.Beta.Threads.Messages.Message;
export type MessagesPage = OpenAI.Beta.Threads.Messages.MessagesPage;
export type Run = OpenAI.Beta.Threads.Runs.Run;
export type Thread = OpenAI.Beta.Threads.Thread;
export type Assistant = OpenAI.Beta.Assistant;
export type FileObject = OpenAI.Files.FileObject;