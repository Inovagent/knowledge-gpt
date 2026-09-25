"""Offline guard behavior tests; only disposable Git repositories are modified."""
from pathlib import Path
import os, shutil, subprocess, tempfile, unittest
SCRIPT = Path(__file__).with_name('docs_impact_guard.sh')
class GuardTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
  self.git('init','-q');self.git('config','user.name','Docs fixtures');self.git('config','user.email','docs@example.invalid')
  self.write('scripts/docs_impact_guard.sh',SCRIPT.read_text());self.write('scripts/docs_hot_paths.txt','^src/\n^child$\n')
  self.write('scripts/docs_contract_map.tsv','api\t^src/\t^docs/api\\.md$\nchild\t^child$\t^docs/dependency\\.md$\n')
  for f in ['src/api.txt','docs/api.md','README.md','docs/dependency.md']:self.write(f,'original\n')
  self.git('add','.');self.git('commit','-qm','baseline');self.base=self.git('rev-parse','HEAD').strip()
 def write(self,p,s):
  f=self.root/p;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(s)
 def git(self,*args):
  return subprocess.check_output(['git','-c','core.fsmonitor=false',*args],cwd=self.root,text=True,stderr=subprocess.PIPE)
 def guard(self,*args,env=None):
  return subprocess.run(['bash','scripts/docs_impact_guard.sh',*args],cwd=self.root,text=True,capture_output=True,env={**os.environ,**(env or {})})
 def change(self):self.write('src/api.txt','changed\n')
 def test_clean(self):self.assertEqual(self.guard('--worktree').returncode,0)
 def test_unrelated(self):self.write('notes.txt','x');self.assertEqual(self.guard('--worktree').returncode,0)
 def test_untracked_hot(self):self.write('src/new file.txt','x');self.assertEqual(self.guard('--worktree').returncode,1)
 def test_doc_matches_category(self):self.change();self.write('docs/api.md','updated');self.assertEqual(self.guard('--worktree').returncode,0)
 def test_unrelated_readme_does_not_satisfy(self):self.change();self.write('README.md','other');self.assertEqual(self.guard('--worktree').returncode,1)
 def test_deleted_doc_is_not_evidence(self):self.change();(self.root/'docs/api.md').unlink();self.assertEqual(self.guard('--worktree').returncode,1)
 def test_deleted_source_is_a_change(self):(self.root/'src/api.txt').unlink();self.assertEqual(self.guard('--worktree').returncode,1)
 def test_reason_parser_commit_and_ci_agree(self):
  self.change();self.git('add','src/api.txt');self.git('commit','-qm','code')
  # Stage another change to exercise the same parser in commit mode.
  self.write('src/api.txt','changed again');self.git('add','src/api.txt')
  for text,expected in [('Docs-Impact: none',1),('Docs impact: none - ',1),('Docs-Impact: none - internal refactor',0),('Docs impact: none — internal refactor',0),('ordinary text',1)]:
   with self.subTest(text=text):
    self.write('message.txt',text)
    self.assertEqual(self.guard('--commit-msg','message.txt').returncode,expected)
    self.assertEqual(self.guard('--ci',env={'BASE_REF':self.base,'DOCS_IMPACT_TEXT':text}).returncode,expected)
 def test_ci_requires_valid_base(self):self.assertEqual(self.guard('--ci',env={'BASE_REF':'missing-ref'}).returncode,2)
 def test_failed_diff_is_error(self):
  fake=self.root/'fake';fake.mkdir();real=shutil.which('git');f=fake/'git';f.write_text('#!/bin/sh\nif [ "$1" = diff ]; then exit 42; fi\nexec "'+real+'" "$@"\n');f.chmod(0o755)
  self.assertEqual(self.guard('--worktree',env={'PATH':str(fake)+os.pathsep+os.environ['PATH']}).returncode,2)
 def test_staged_excludes_unstaged_docs(self):self.change();self.git('add','src/api.txt');self.write('docs/api.md','not staged');self.write('message.txt','code');self.assertEqual(self.guard('--commit-msg','message.txt').returncode,1)
 def test_staged_advisory(self):self.change();self.git('add','src/api.txt');r=self.guard('--staged');self.assertEqual(r.returncode,0);self.assertIn('api:',r.stderr)
 def test_repeat_content_and_clean_reset(self):
  self.change();self.assertEqual(self.guard().returncode,2);self.assertEqual(self.guard().returncode,0)
  self.write('src/api.txt','new content');self.assertEqual(self.guard().returncode,2)
  self.git('restore','src/api.txt');self.assertEqual(self.guard().returncode,0)
  self.change();self.assertEqual(self.guard().returncode,2)
 def test_multiple_categories_need_each_doc(self):
  self.change();self.write('child','pointer');self.write('docs/api.md','updated');self.assertEqual(self.guard('--worktree').returncode,1)
  self.write('docs/dependency.md','updated');self.assertEqual(self.guard('--worktree').returncode,0)
 def test_rename_counts_old_and_new_contracts(self):
  self.git('mv','src/api.txt','src/new.txt');self.assertEqual(self.guard('--worktree').returncode,1)
 def test_worktree_marker_is_git_resolved(self):
  # Disposable fixture worktree; never a project checkout.
  child=self.root/'fixture-worktree';self.git('worktree','add','-qb','fixture',str(child))
  original=self.root;self.root=child
  try:
   self.change();self.assertEqual(self.guard().returncode,2);self.assertEqual(self.guard().returncode,0)
   marker=Path(self.git('rev-parse','--git-path','docs_impact_reminded').strip());self.assertTrue(marker.is_file())
  finally:self.root=original
 def test_gitlink_change_is_visible(self):
  other=self.root/'fixture-child';other.mkdir();subprocess.run(['git','init','-q',str(other)],check=True)
  def g(*a):return subprocess.check_output(['git','-c','user.name=Fixture','-c','user.email=fixture@example.invalid',*a],cwd=other,text=True).strip()
  g('commit','--allow-empty','-qm','one');first=g('rev-parse','HEAD');self.git('update-index','--add','--cacheinfo','160000,'+first+',child');self.git('commit','-qm','pin')
  g('commit','--allow-empty','-qm','two');self.git('update-index','--cacheinfo','160000,'+g('rev-parse','HEAD')+',child')
  self.write('message.txt','pointer');self.assertEqual(self.guard('--commit-msg','message.txt').returncode,1)
 def test_test_only_change(self):self.write('src/api.test.js','test');self.assertEqual(self.guard('--worktree').returncode,0)
 def test_invalid_mapping(self):self.write('scripts/docs_contract_map.tsv','broken\t[\tREADME\n');self.assertEqual(self.guard('--worktree').returncode,2)
 def test_no_read_of_unrelated_untracked_file(self):
  self.change();f=self.root/'private-data';f.symlink_to('/does/not/exist');self.assertEqual(self.guard().returncode,2)
 def test_repository_contract_configuration(self):
  for name in ['docs_hot_paths.txt','docs_contract_map.tsv']:
   self.write('scripts/'+name,SCRIPT.with_name(name).read_text())
  self.write('src/backend/routes/capture.js','changed public contract')
  self.assertEqual(self.guard('--worktree').returncode,1)
  self.write('docs/unrelated.md','unrelated note')
  self.assertEqual(self.guard('--worktree').returncode,1)
  self.write('AGENTS.md','updated canonical contract')
  self.assertEqual(self.guard('--worktree').returncode,0)
if __name__=='__main__':unittest.main()
